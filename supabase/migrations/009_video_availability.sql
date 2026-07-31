-- Phase 12: track video availability without deleting historical data.
alter table public.videos
  add column if not exists availability_status text not null default 'active',
  add column if not exists unavailable_count integer not null default 0,
  add column if not exists last_available_at timestamptz,
  add column if not exists first_unavailable_at timestamptz,
  add column if not exists last_unavailable_at timestamptz;

alter table public.videos
  drop constraint if exists videos_availability_status_check;

alter table public.videos
  add constraint videos_availability_status_check
  check (availability_status in (
    'active',
    'unavailable_pending',
    'deleted_or_private',
    'unknown_unavailable'
  ));

alter table public.videos
  drop constraint if exists videos_unavailable_count_nonneg;

alter table public.videos
  add constraint videos_unavailable_count_nonneg
  check (unavailable_count >= 0);

create index if not exists idx_videos_availability_status
  on public.videos (availability_status);
