-- Phase 1: Discovery source unification — track rediscovery on videos.
alter table public.videos
  add column if not exists last_discovered_at timestamptz,
  add column if not exists discovery_count integer not null default 0;

alter table public.videos
  drop constraint if exists videos_discovery_count_nonneg;

alter table public.videos
  add constraint videos_discovery_count_nonneg
  check (discovery_count >= 0);

create index if not exists idx_videos_last_discovered_at
  on public.videos (last_discovered_at desc nulls last);
