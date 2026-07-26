-- Phase 1: Observability foundation (additive only)
-- Does NOT modify existing ranking/cron behavior.
-- Does NOT add derived metrics to video_snapshots.

-- ---------------------------------------------------------------------------
-- 1. Extend channels
-- ---------------------------------------------------------------------------
alter table public.channels
  add column if not exists channel_type text,
  add column if not exists market_relevance numeric(4, 3),
  add column if not exists country text,
  add column if not exists default_language text,
  add column if not exists last_upload_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'channels_market_relevance_range'
  ) then
    alter table public.channels
      add constraint channels_market_relevance_range
      check (
        market_relevance is null
        or (market_relevance >= 0 and market_relevance <= 1)
      );
  end if;
end $$;

create index if not exists idx_channels_channel_type
  on public.channels (channel_type);

create index if not exists idx_channels_market_relevance
  on public.channels (market_relevance desc nulls last);

-- ---------------------------------------------------------------------------
-- 2. Extend videos
-- ---------------------------------------------------------------------------
alter table public.videos
  add column if not exists duration_seconds integer,
  add column if not exists is_short boolean,
  add column if not exists is_live boolean,
  add column if not exists is_topic_content boolean,
  add column if not exists first_discovered_at timestamptz,
  add column if not exists last_observed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'videos_duration_seconds_nonneg'
  ) then
    alter table public.videos
      add constraint videos_duration_seconds_nonneg
      check (duration_seconds is null or duration_seconds >= 0);
  end if;
end $$;

create index if not exists idx_videos_first_discovered_at
  on public.videos (first_discovered_at desc nulls last);

create index if not exists idx_videos_last_observed_at
  on public.videos (last_observed_at desc nulls last);

create index if not exists idx_videos_is_short
  on public.videos (is_short)
  where is_short is true;

-- last_seen_at: presence confirmed via discovery/ranking/collect (unchanged)
-- last_observed_at: measurement success timestamp (set in Phase 2+)

-- ---------------------------------------------------------------------------
-- 3. channel_watchlist
-- updated_at is maintained by repository on write (no DB trigger in Phase 1)
-- ---------------------------------------------------------------------------
create table if not exists public.channel_watchlist (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null
    references public.channels (youtube_channel_id) on delete cascade,
  name text,
  category text,
  source text,
  priority integer not null default 0,
  notes text,
  watch_tier text not null default 'normal',
  watch_status text not null default 'seed',
  next_check_at timestamptz,
  last_checked_at timestamptz,
  failure_count integer not null default 0,
  lock_token uuid,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint channel_watchlist_watch_tier_check
    check (watch_tier in ('hot', 'active', 'normal', 'cold', 'archive')),

  constraint channel_watchlist_watch_status_check
    check (watch_status in (
      'seed', 'discovered', 'active', 'paused', 'rejected', 'decayed'
    )),

  constraint channel_watchlist_priority_nonneg
    check (priority >= 0),

  constraint channel_watchlist_failure_count_nonneg
    check (failure_count >= 0)
);

create unique index if not exists idx_channel_watchlist_channel_id
  on public.channel_watchlist (channel_id);

create index if not exists idx_channel_watchlist_next_check_at
  on public.channel_watchlist (next_check_at nulls first);

create index if not exists idx_channel_watchlist_tier_status
  on public.channel_watchlist (watch_tier, watch_status);

create index if not exists idx_channel_watchlist_due
  on public.channel_watchlist (watch_status, next_check_at nulls first)
  where watch_status in ('seed', 'discovered', 'active');

-- ---------------------------------------------------------------------------
-- 4. candidate_discoveries
-- ---------------------------------------------------------------------------
create table if not exists public.candidate_discoveries (
  id uuid primary key default gen_random_uuid(),
  video_id text not null
    references public.videos (youtube_video_id) on delete cascade,
  channel_id text
    references public.channels (youtube_channel_id) on delete set null,
  source_type text not null,
  source_key text not null,
  discovered_at timestamptz not null default now(),
  metadata jsonb
);

create unique index if not exists idx_candidate_discoveries_dedup
  on public.candidate_discoveries (video_id, source_type, source_key);

create index if not exists idx_candidate_discoveries_source_type
  on public.candidate_discoveries (source_type, discovered_at desc);

create index if not exists idx_candidate_discoveries_discovered_at
  on public.candidate_discoveries (discovered_at desc);

create index if not exists idx_candidate_discoveries_video_id
  on public.candidate_discoveries (video_id);

-- ---------------------------------------------------------------------------
-- 5. measurement_schedule
-- updated_at is maintained by repository on write (no DB trigger in Phase 1)
-- ---------------------------------------------------------------------------
create table if not exists public.measurement_schedule (
  video_id text primary key
    references public.videos (youtube_video_id) on delete cascade,
  measurement_tier text not null default 'normal',
  measurement_status text not null default 'pending',
  next_measurement_at timestamptz,
  last_measured_at timestamptz,
  failure_count integer not null default 0,
  lock_token uuid,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint measurement_schedule_tier_check
    check (measurement_tier in ('hot', 'active', 'normal', 'cold')),

  constraint measurement_schedule_status_check
    check (measurement_status in ('pending', 'active', 'paused', 'failed')),

  constraint measurement_schedule_failure_count_nonneg
    check (failure_count >= 0)
);

create index if not exists idx_measurement_schedule_next_measurement_at
  on public.measurement_schedule (next_measurement_at nulls first);

create index if not exists idx_measurement_schedule_tier_status
  on public.measurement_schedule (measurement_tier, measurement_status);

create index if not exists idx_measurement_schedule_due
  on public.measurement_schedule (measurement_status, next_measurement_at nulls first)
  where measurement_status in ('pending', 'active');

-- ---------------------------------------------------------------------------
-- 6. discovery_runs (separate from snapshot_runs)
-- ---------------------------------------------------------------------------
create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null default 'running',
  algorithm_version text not null default 'discovery-v1',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cursor text,
  items_processed integer not null default 0,
  items_discovered integer not null default 0,
  items_failed integer not null default 0,
  youtube_quota_estimate integer not null default 0,
  error_summary text,
  metadata jsonb,

  constraint discovery_runs_status_check
    check (status in ('running', 'success', 'partial', 'failed')),

  constraint discovery_runs_items_processed_nonneg
    check (items_processed >= 0),

  constraint discovery_runs_items_discovered_nonneg
    check (items_discovered >= 0),

  constraint discovery_runs_items_failed_nonneg
    check (items_failed >= 0),

  constraint discovery_runs_youtube_quota_estimate_nonneg
    check (youtube_quota_estimate >= 0)
);

create index if not exists idx_discovery_runs_started_at
  on public.discovery_runs (started_at desc);

create index if not exists idx_discovery_runs_status
  on public.discovery_runs (status, started_at desc);

create index if not exists idx_discovery_runs_algorithm_version
  on public.discovery_runs (algorithm_version, started_at desc);

-- ---------------------------------------------------------------------------
-- 7. ranking_snapshots (DB ranking output for Phase 6; not connected yet)
-- ---------------------------------------------------------------------------
create table if not exists public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  generated_at timestamptz not null default now(),
  period text not null,
  genre text not null default 'all',
  video_id text not null
    references public.videos (youtube_video_id) on delete cascade,
  rank integer not null,
  radar_score numeric,
  score_version text not null default 'radar-v1',
  metadata jsonb,

  constraint ranking_snapshots_period_check
    check (period in ('24h', '3d', '7d', '30d')),

  constraint ranking_snapshots_genre_check
    check (genre in (
      'all', 'entertainment', 'music', 'game', 'education',
      'news', 'howto', 'sports', 'other'
    )),

  constraint ranking_snapshots_rank_positive
    check (rank > 0)
);

create unique index if not exists idx_ranking_snapshots_batch_period_genre_video
  on public.ranking_snapshots (batch_id, period, genre, video_id);

create index if not exists idx_ranking_snapshots_period_genre_generated
  on public.ranking_snapshots (period, genre, generated_at desc);

create index if not exists idx_ranking_snapshots_batch_id
  on public.ranking_snapshots (batch_id);

create index if not exists idx_ranking_snapshots_score_version
  on public.ranking_snapshots (score_version, generated_at desc);

-- ---------------------------------------------------------------------------
-- 8. RLS: new tables only (no anon/authenticated policies)
-- ---------------------------------------------------------------------------
alter table public.channel_watchlist enable row level security;
alter table public.candidate_discoveries enable row level security;
alter table public.measurement_schedule enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.ranking_snapshots enable row level security;

-- service_role bypasses RLS in Supabase; no policies = no client access

-- ---------------------------------------------------------------------------
-- 9. Observability views (public schema, restricted access)
-- ---------------------------------------------------------------------------
create or replace view public.v_observability_watchlist_summary as
select
  count(*)::bigint as total,
  count(*) filter (where watch_tier = 'hot')::bigint as tier_hot,
  count(*) filter (where watch_tier = 'active')::bigint as tier_active,
  count(*) filter (where watch_tier = 'normal')::bigint as tier_normal,
  count(*) filter (where watch_tier = 'cold')::bigint as tier_cold,
  count(*) filter (where watch_tier = 'archive')::bigint as tier_archive,
  count(*) filter (where watch_status = 'seed')::bigint as status_seed,
  count(*) filter (where watch_status = 'active')::bigint as status_active,
  count(*) filter (where watch_status = 'paused')::bigint as status_paused,
  count(*) filter (where watch_status = 'rejected')::bigint as status_rejected,
  count(*) filter (
    where watch_status in ('seed', 'discovered', 'active')
      and (next_check_at is null or next_check_at <= now())
  )::bigint as due_now
from public.channel_watchlist;

create or replace view public.v_observability_measurement_summary as
select
  count(*)::bigint as total,
  count(*) filter (
    where measurement_status in ('pending', 'active')
      and (next_measurement_at is null or next_measurement_at <= now())
  )::bigint as due_now,
  count(*) filter (where measurement_tier = 'hot')::bigint as tier_hot,
  count(*) filter (where measurement_status = 'failed')::bigint as status_failed
from public.measurement_schedule;

create or replace view public.v_observability_discovery_summary as
select
  source_type,
  count(*)::bigint as total
from public.candidate_discoveries
group by source_type
order by total desc;

create or replace view public.v_observability_latest_discovery_run as
select *
from public.discovery_runs
order by started_at desc
limit 1;

revoke all on public.v_observability_watchlist_summary from anon, authenticated;
revoke all on public.v_observability_measurement_summary from anon, authenticated;
revoke all on public.v_observability_discovery_summary from anon, authenticated;
revoke all on public.v_observability_latest_discovery_run from anon, authenticated;
