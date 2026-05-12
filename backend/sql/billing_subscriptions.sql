-- mallog24 billing subscription model (multi-provider ready)
-- Run this in Supabase SQL Editor before using /api/billing/* endpoints.

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'portone',
  customer_id text unique,
  subscription_id text unique,
  price_id text,
  status text not null default 'inactive',
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro', 'enterprise')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  checkout_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing table migration support (from stripe-only constraint)
alter table if exists public.billing_subscriptions
  alter column provider set default 'portone';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'billing_subscriptions_provider_check'
  ) then
    alter table public.billing_subscriptions
      drop constraint billing_subscriptions_provider_check;
  end if;

  alter table public.billing_subscriptions
    add constraint billing_subscriptions_provider_check
    check (provider in ('portone', 'tosspayments', 'stripe', 'apple'));
end $$;

create index if not exists idx_billing_subscriptions_status
  on public.billing_subscriptions (status);

create index if not exists idx_billing_subscriptions_customer_id
  on public.billing_subscriptions (customer_id);

create index if not exists idx_billing_subscriptions_subscription_id
  on public.billing_subscriptions (subscription_id);

alter table if exists public.billing_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'billing_subscriptions_select_own'
  ) then
    create policy billing_subscriptions_select_own
      on public.billing_subscriptions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'billing_subscriptions_insert_own'
  ) then
    create policy billing_subscriptions_insert_own
      on public.billing_subscriptions
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'billing_subscriptions_update_own'
  ) then
    create policy billing_subscriptions_update_own
      on public.billing_subscriptions
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
