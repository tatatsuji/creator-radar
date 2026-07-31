-- Phase 3: cache YouTube uploads playlist ID per channel.
alter table public.channels
  add column if not exists uploads_playlist_id text;

create index if not exists idx_channels_uploads_playlist_id
  on public.channels (uploads_playlist_id)
  where uploads_playlist_id is not null;
