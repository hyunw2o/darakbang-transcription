-- Add per-user ownership and RLS guard to transcription history.
-- Run this in Supabase SQL Editor.
--
-- NOTE:
-- - If backend uses service_role key, service-role requests bypass RLS.
-- - RLS still protects user-scoped access from anon/authenticated contexts.

alter table if exists public.transcriptions
  add column if not exists user_id uuid;

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
