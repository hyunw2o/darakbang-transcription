-- Prevent duplicate active transcription jobs for the same owner and source file.
-- Run this once in the Supabase SQL Editor.

alter table if exists public.transcription_jobs
  add column if not exists source_sha256 text;

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

notify pgrst, 'reload schema';
