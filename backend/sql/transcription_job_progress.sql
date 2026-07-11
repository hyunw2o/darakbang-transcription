-- Detailed transcription progress and source-timeline chunk manifest.
-- Safe to run more than once in the Supabase SQL Editor.

alter table if exists public.transcription_jobs
  add column if not exists progress jsonb default '{"stage":"queued","percent":5}'::jsonb,
  add column if not exists chunk_manifest jsonb default '[]'::jsonb;

update public.transcription_jobs
set progress = coalesce(progress, '{"stage":"queued","percent":5}'::jsonb)
where progress is null;

update public.transcription_jobs
set chunk_manifest = coalesce(chunk_manifest, '[]'::jsonb)
where chunk_manifest is null;

alter table if exists public.transcription_jobs
  alter column progress set default '{"stage":"queued","percent":5}'::jsonb,
  alter column progress set not null,
  alter column chunk_manifest set default '[]'::jsonb,
  alter column chunk_manifest set not null;

NOTIFY pgrst, 'reload schema';
