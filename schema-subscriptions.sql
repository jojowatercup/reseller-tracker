-- Run this once in your Supabase project's SQL Editor, IN ADDITION TO
-- schema.sql (which you already ran back in Milestone 3):
-- Dashboard -> SQL Editor -> New query -> paste this whole file in -> Run.
--
-- Adds a "subscriptions" table that tracks each user's Pro status.
--
-- Unlike "sales", this table is READ-ONLY from the browser's point of
-- view — there's no "insert/update your own subscription" policy below,
-- on purpose. If a signed-in user could write to this table themselves,
-- they could just set their own status to 'active' and get Pro for
-- free. The only thing allowed to write here is the Stripe webhook (a
-- small server-side function, not this app's regular browser code),
-- using Supabase's secret service_role key, which bypasses RLS
-- entirely. That's a deliberate, narrow exception to "nothing in this
-- project uses the secret key" — made only because there's no other way
-- for a server to confirm someone actually paid.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,

  -- 'inactive' until the webhook says otherwise — also what it reverts
  -- to if a subscription is canceled or a renewal payment fails.
  status text not null default 'inactive',

  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- The only policy: you can check your OWN Pro status. Nothing else —
-- no insert, no update, no delete policy for regular signed-in users.
create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);
