-- Phase 3 P0: channels, channel_snapshots, snapshot_runs, videos extension

create table if not exists public.channels (
  youtube_channel_id text primary key,
  name text,
  thumbnail_url text,
  subscriber_count_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null references public.channels (youtube_channel_id) on delete cascade,
  subscriber_count bigint,
  captured_at timestamptz not null default now()
);

create table if not exists public.snapshot_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  videos_total integer not null default 0,
  videos_success integer not null default 0,
  videos_failed integer not null default 0,
  videos_skipped integer not null default 0,
  channels_total integer not null default 0,
  channels_success integer not null default 0,
  channels_skipped integer not null default 0,
  youtube_quota_used integer not null default 0,
  error_summary text
);

alter table public.videos
  add column if not exists is_active boolean not null default true,
  add column if not exists last_seen_at timestamptz;

-- Backfill channels from existing video rows before adding FK
insert into public.channels (youtube_channel_id, name, updated_at)
select distinct on (v.channel_id)
  v.channel_id,
  v.channel_name,
  now()
from public.videos v
where v.channel_id is not null
on conflict (youtube_channel_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'videos_channel_id_fkey'
  ) then
    alter table public.videos
      add constraint videos_channel_id_fkey
      foreign key (channel_id)
      references public.channels (youtube_channel_id);
  end if;
end $$;

create index if not exists idx_channel_snapshots_channel_id
  on public.channel_snapshots (channel_id);

create index if not exists idx_channel_snapshots_captured_at
  on public.channel_snapshots (captured_at desc);

create index if not exists idx_channel_snapshots_channel_time
  on public.channel_snapshots (channel_id, captured_at desc);

create unique index if not exists idx_channel_snapshots_hourly_dedup
  on public.channel_snapshots (
    channel_id,
    (date_trunc('hour', captured_at at time zone 'UTC'))
  );

create unique index if not exists idx_video_snapshots_hourly_dedup
  on public.video_snapshots (
    video_id,
    (date_trunc('hour', captured_at at time zone 'UTC'))
  );

create index if not exists idx_videos_is_active_last_seen
  on public.videos (is_active, last_seen_at desc);

create index if not exists idx_snapshot_runs_started_at
  on public.snapshot_runs (started_at desc);

create index if not exists idx_snapshot_runs_status
  on public.snapshot_runs (status, started_at desc);
