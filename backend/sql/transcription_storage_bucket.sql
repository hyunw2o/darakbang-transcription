-- Shared storage bucket for queued transcription inputs.
-- Run this in Supabase SQL Editor, then run:
--   NOTIFY pgrst, 'reload schema';

insert into storage.buckets (id, name, public)
values ('transcription-inputs', 'transcription-inputs', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
