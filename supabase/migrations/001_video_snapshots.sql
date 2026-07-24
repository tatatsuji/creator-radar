-- Creator Radar: video metadata and time-series snapshots

create table if not exists public.videos (
  youtube_video_id text primary key,
  title text,
  channel_id text,
  channel_name text,
  thumbnail_url text,
  published_at timestamptz,
  category_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.video_snapshots (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.videos (youtube_video_id) on delete cascade,
  view_count bigint not null,
  like_count bigint,
  comment_count bigint,
  captured_at timestamptz not null default now()
);

create index if not exists idx_video_snapshots_video_id
  on public.video_snapshots (video_id);

create index if not exists idx_video_snapshots_captured_at
  on public.video_snapshots (captured_at desc);

create index if not exists idx_video_snapshots_video_id_captured_at
  on public.video_snapshots (video_id, captured_at desc);
