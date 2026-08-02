-- Step1-A: video_format / live_state classification (additive)

alter table public.videos
  add column if not exists video_format text,
  add column if not exists live_state text,
  add column if not exists live_broadcast_content text,
  add column if not exists live_scheduled_start_at timestamptz,
  add column if not exists live_actual_start_at timestamptz,
  add column if not exists live_actual_end_at timestamptz,
  add column if not exists live_metadata_fetch_status text,
  add column if not exists live_metadata_checked_at timestamptz,
  add column if not exists format_signals jsonb;

alter table public.videos
  drop constraint if exists videos_video_format_check;

alter table public.videos
  add constraint videos_video_format_check
  check (video_format is null or video_format in ('short', 'regular', 'unknown'));

alter table public.videos
  drop constraint if exists videos_live_state_check;

alter table public.videos
  add constraint videos_live_state_check
  check (
    live_state is null
    or live_state in ('none', 'active', 'upcoming', 'ended', 'unknown')
  );

alter table public.videos
  drop constraint if exists videos_live_metadata_fetch_status_check;

alter table public.videos
  add constraint videos_live_metadata_fetch_status_check
  check (
    live_metadata_fetch_status is null
    or live_metadata_fetch_status in ('success', 'failed', 'not_checked')
  );

create index if not exists idx_videos_video_format
  on public.videos (video_format)
  where video_format is not null;

create index if not exists idx_videos_live_state
  on public.videos (live_state)
  where live_state is not null;
