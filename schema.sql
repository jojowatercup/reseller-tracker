-- Run this once in your Supabase project's SQL Editor:
-- Dashboard -> SQL Editor -> New query -> paste this whole file in -> Run.
--
-- It creates the "sales" table that holds every saved sale, and locks it
-- down with Row Level Security (RLS) so a signed-in seller can only ever
-- see or change their OWN rows — never anyone else's.

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),

  -- Filled in automatically from the logged-in request — the browser
  -- never sends this, so there's no way to spoof someone else's id.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  platform text not null,
  price numeric not null,
  ship_charged numeric not null default 0,
  ship_cost numeric not null default 0,
  item_cost numeric not null default 0,
  fee numeric not null,
  keep numeric not null,
  created_at timestamptz not null default now()
);

-- RLS is OFF by default, which would let any signed-in user read or edit
-- every row in this table — everyone's sales, mixed together. Turning it
-- on, then adding the policies below, is what actually keeps each
-- seller's data private. Without this step, accounts would technically
-- work, but there'd be no real privacy between sellers.
alter table public.sales enable row level security;

create policy "Users can view their own sales"
  on public.sales for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sales"
  on public.sales for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own sales"
  on public.sales for delete
  using (auth.uid() = user_id);
