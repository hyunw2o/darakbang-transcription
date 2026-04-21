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

create index if not exists idx_transcription_jobs_owner_created_at
  on public.transcription_jobs (owner_key, created_at desc);

create index if not exists idx_transcription_jobs_user_created_at
  on public.transcription_jobs (user_id, created_at desc);
