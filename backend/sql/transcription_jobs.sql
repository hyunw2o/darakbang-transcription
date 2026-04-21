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
  error text
);

alter table if exists public.transcription_jobs
  add column if not exists storage_bucket text,
  add column if not exists storage_object_path text,
  add column if not exists source_mime_type text,
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
  add column if not exists error text;

create index if not exists idx_transcription_jobs_owner_created_at
  on public.transcription_jobs (owner_key, created_at desc);

create index if not exists idx_transcription_jobs_user_created_at
  on public.transcription_jobs (user_id, created_at desc);
