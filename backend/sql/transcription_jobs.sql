-- Persistent transcription job state for guest and signed-in users.
-- Run this in Supabase SQL Editor, then run:
--   NOTIFY pgrst, 'reload schema';

create table if not exists public.transcription_jobs (
  task_id text primary key,
  owner_key text not null,
  user_id uuid null references auth.users(id) on delete set null,
  is_guest boolean not null default false,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_bucket text,
  storage_object_path text,
  source_mime_type text,
  source_sha256 text,
  worker_id text,
  claimed_at timestamptz,
  language text,
  transcription_type text,
  correction_mode text,
  audio_seconds integer not null default 0,
  raw_text text,
  corrected_text text,
  characters integer not null default 0,
  darakbang_optimized boolean not null default false,
  engine text,
  content_style text,
  progress jsonb not null default '{"stage":"queued","percent":5}'::jsonb,
  chunk_manifest jsonb not null default '[]'::jsonb,
  error text
);

alter table if exists public.transcription_jobs
  add column if not exists owner_key text,
  add column if not exists user_id uuid,
  add column if not exists is_guest boolean default false,
  add column if not exists status text default 'queued',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists storage_bucket text,
  add column if not exists storage_object_path text,
  add column if not exists source_mime_type text,
  add column if not exists source_sha256 text,
  add column if not exists worker_id text,
  add column if not exists claimed_at timestamptz,
  add column if not exists language text,
  add column if not exists transcription_type text,
  add column if not exists correction_mode text,
  add column if not exists audio_seconds integer not null default 0,
  add column if not exists raw_text text,
  add column if not exists corrected_text text,
  add column if not exists characters integer not null default 0,
  add column if not exists darakbang_optimized boolean not null default false,
  add column if not exists engine text,
  add column if not exists content_style text,
  add column if not exists progress jsonb default '{"stage":"queued","percent":5}'::jsonb,
  add column if not exists chunk_manifest jsonb default '[]'::jsonb,
  add column if not exists error text;

do $$
begin
  begin
    alter table public.transcription_jobs
      add constraint transcription_jobs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  exception
    when duplicate_object then null;
  end;
end $$;

update public.transcription_jobs
set owner_key = coalesce(nullif(owner_key, ''), nullif(user_id::text, ''), task_id)
where owner_key is null or owner_key = '';

update public.transcription_jobs
set is_guest = coalesce(is_guest, false)
where is_guest is null;

update public.transcription_jobs
set status = coalesce(nullif(status, ''), 'queued')
where status is null or status = '';

update public.transcription_jobs
set created_at = coalesce(created_at, now())
where created_at is null;

update public.transcription_jobs
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.transcription_jobs
set audio_seconds = coalesce(audio_seconds, 0)
where audio_seconds is null;

update public.transcription_jobs
set characters = coalesce(characters, 0)
where characters is null;

update public.transcription_jobs
set darakbang_optimized = coalesce(darakbang_optimized, false)
where darakbang_optimized is null;

update public.transcription_jobs
set progress = coalesce(progress, '{"stage":"queued","percent":5}'::jsonb)
where progress is null;

update public.transcription_jobs
set chunk_manifest = coalesce(chunk_manifest, '[]'::jsonb)
where chunk_manifest is null;

alter table if exists public.transcription_jobs
  alter column owner_key set not null,
  alter column is_guest set default false,
  alter column is_guest set not null,
  alter column status set default 'queued',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column audio_seconds set default 0,
  alter column audio_seconds set not null,
  alter column characters set default 0,
  alter column characters set not null,
  alter column darakbang_optimized set default false,
  alter column darakbang_optimized set not null,
  alter column progress set default '{"stage":"queued","percent":5}'::jsonb,
  alter column progress set not null,
  alter column chunk_manifest set default '[]'::jsonb,
  alter column chunk_manifest set not null;

create index if not exists idx_transcription_jobs_owner_created_at
  on public.transcription_jobs (owner_key, created_at desc);

create index if not exists idx_transcription_jobs_user_created_at
  on public.transcription_jobs (user_id, created_at desc);

create index if not exists idx_transcription_jobs_active_source
  on public.transcription_jobs (
    owner_key,
    source_sha256,
    language,
    transcription_type,
    correction_mode,
    created_at
  )
  where source_sha256 is not null and status in ('queued', 'processing');
