-- Add per-user ownership to transcription history.
-- Run this in Supabase SQL Editor before enabling user-scoped /api/history and /api/status.

alter table if exists public.transcriptions
  add column if not exists user_id uuid;

create index if not exists idx_transcriptions_user_id_created_at
  on public.transcriptions (user_id, created_at desc);

create index if not exists idx_transcriptions_task_user
  on public.transcriptions (task_id, user_id);
