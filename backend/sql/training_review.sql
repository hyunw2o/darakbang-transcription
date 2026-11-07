-- Run AFTER training_data_assets.sql. No public access to review assets.
update storage.buckets set public = false where id = 'training-audio';

alter table public.training_audio_assets
  add column if not exists review_import_key text,
  add column if not exists dataset_split text not null default 'unassigned'
    check (dataset_split in ('unassigned', 'train', 'validation', 'test'));
create unique index if not exists training_audio_review_import_unique
  on public.training_audio_assets(review_import_key) where review_import_key is not null;

alter table public.training_text_samples
  add column if not exists start_seconds double precision,
  add column if not exists end_seconds double precision,
  add column if not exists review_version integer not null default 0,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists verbatim_verified boolean not null default false,
  add column if not exists listened boolean not null default false;

-- Audio review rows cannot become orphaned training examples.
create or replace function public.delete_audio_review_samples()
returns trigger language plpgsql set search_path = public as $$
begin
  delete from public.training_text_samples
  where audio_asset_id = old.id and source_type = 'audio_review';
  return old;
end;
$$;
drop trigger if exists delete_audio_review_samples on public.training_audio_assets;
create trigger delete_audio_review_samples before delete on public.training_audio_assets
for each row execute function public.delete_audio_review_samples();

-- Review writes go through the authenticated admin API using the service role.
revoke insert, update on public.training_audio_assets from anon, authenticated;
revoke insert, update on public.training_text_samples from anon, authenticated;
notify pgrst, 'reload schema';
