-- Denormalize channel subscriber count onto video_snapshots for time-series analysis.

alter table public.video_snapshots
  add column if not exists subscriber_count bigint;

comment on column public.video_snapshots.subscriber_count is
  'Channel subscriber count at capture time. Null when hidden or unavailable.';
