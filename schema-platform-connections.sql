-- Run this once in your Supabase project's SQL Editor, IN ADDITION TO
-- schema.sql and schema-subscriptions.sql:
-- Dashboard -> SQL Editor -> New query -> paste this whole file in -> Run.
--
-- Sets up storage for Milestone 4's marketplace connections (Etsy first).
-- Two tables, each locked down differently on purpose:

-- ---------------------------------------------------------------------
-- 1. platform_connections — holds real Etsy access/refresh tokens.
--
-- This is the most locked-down table in the whole project: RLS is on,
-- and there are NO policies granted to regular signed-in users at all —
-- not even to read their own row. That's deliberate. A stolen Etsy
-- access token could pull real order data, so the browser should never
-- be able to read one, only the server-side functions (using the
-- secret service_role key) that actually need to call Etsy's API.
create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  external_shop_id text,
  external_shop_name text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.platform_connections enable row level security;
-- No policies here — see comment above. RLS with zero policies means
-- "deny by default" for every regular user; only service_role bypasses it.

-- A safe, read-only window into the table above, with the sensitive
-- columns (the tokens themselves) left out entirely. Views in Postgres
-- run with their *creator's* permissions by default (not RLS-checked
-- against the base table for the caller), so this view can see past
-- platform_connections' total lockdown — but its own "where user_id =
-- auth.uid()" still means each signed-in user only ever gets their own
-- row back, never anyone else's.
create view public.platform_connection_status as
  select platform, external_shop_name, connected_at
  from public.platform_connections
  where user_id = auth.uid();

grant select on public.platform_connection_status to authenticated;

-- ---------------------------------------------------------------------
-- 2. oauth_flow_state — a short-lived handoff between "click Connect
-- Etsy" and "Etsy sends you back here." OAuth's PKCE security step
-- needs a secret value generated *before* you leave for Etsy, then used
-- again when you return — this table is where that secret waits in the
-- meantime. Rows are deleted by the callback function right after use.
create table if not exists public.oauth_flow_state (
  state text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null,
  code_verifier text not null,
  created_at timestamptz not null default now()
);

alter table public.oauth_flow_state enable row level security;

-- Users can start their own connection attempt (insert one row)...
create policy "Users can start their own OAuth attempt"
  on public.oauth_flow_state for insert
  with check (auth.uid() = user_id);

-- ...but never read, change, or delete it afterward. Only the callback
-- function (service_role) looks it up, once, to complete the exchange.
