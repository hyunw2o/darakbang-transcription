-- mallog24 monthly usage quota model
-- Run this in Supabase SQL Editor before using /api/usage and quota-based upload guard.

create table if not exists public.user_usage_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro', 'enterprise')),
  used_audio_seconds integer not null default 0 check (used_audio_seconds >= 0),
  usage_month date not null default (date_trunc('month', now())::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_usage_plan_tier_month
  on public.user_usage_quotas (plan_tier, usage_month);

create or replace function public.reset_monthly_free_usage(target_month date default date_trunc('month', now())::date)
returns integer
language plpgsql
security definer
as $$
declare
  v_updated_count integer := 0;
begin
  update public.user_usage_quotas
  set
    used_audio_seconds = 0,
    usage_month = target_month,
    updated_at = now()
  where
    plan_tier = 'free'
    and (usage_month <> target_month or used_audio_seconds <> 0);

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

alter table if exists public.user_usage_quotas enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_usage_quotas'
      and policyname = 'user_usage_quotas_select_own'
  ) then
    create policy user_usage_quotas_select_own
      on public.user_usage_quotas
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_usage_quotas'
      and policyname = 'user_usage_quotas_insert_own'
  ) then
    create policy user_usage_quotas_insert_own
      on public.user_usage_quotas
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_usage_quotas'
      and policyname = 'user_usage_quotas_update_own'
  ) then
    create policy user_usage_quotas_update_own
      on public.user_usage_quotas
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
