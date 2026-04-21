-- Add per-user ownership and RLS guard to transcription history.
-- Run this in Supabase SQL Editor.
--
-- NOTE:
-- - If backend uses service_role key, service-role requests bypass RLS.
-- - RLS still protects user-scoped access from anon/authenticated contexts.

alter table if exists public.transcriptions
  add column if not exists user_id uuid,
  add column if not exists status text default 'queued',
  add column if not exists created_at timestamptz default now(),
  add column if not exists raw_text text,
  add column if not exists corrected_text text,
  add column if not exists characters integer default 0,
  add column if not exists darakbang_optimized boolean default false,
  add column if not exists engine text,
  add column if not exists transcription_type text,
  add column if not exists language text,
  add column if not exists error text,
  add column if not exists content_style text;

update public.transcriptions
set status = coalesce(nullif(status, ''), 'queued')
where status is null or status = '';

update public.transcriptions
set created_at = coalesce(created_at, now())
where created_at is null;

update public.transcriptions
set characters = coalesce(characters, 0)
where characters is null;

update public.transcriptions
set darakbang_optimized = coalesce(darakbang_optimized, false)
where darakbang_optimized is null;

alter table if exists public.transcriptions
  alter column status set default 'queued',
  alter column created_at set default now(),
  alter column characters set default 0,
  alter column darakbang_optimized set default false;

create index if not exists idx_transcriptions_user_id_created_at
  on public.transcriptions (user_id, created_at desc);

create index if not exists idx_transcriptions_task_user
  on public.transcriptions (task_id, user_id);

alter table if exists public.transcriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_select_own'
  ) then
    create policy transcriptions_select_own
      on public.transcriptions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_insert_own'
  ) then
    create policy transcriptions_insert_own
      on public.transcriptions
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_update_own'
  ) then
    create policy transcriptions_update_own
      on public.transcriptions
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transcriptions'
      and policyname = 'transcriptions_delete_own'
  ) then
    create policy transcriptions_delete_own
      on public.transcriptions
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
