-- Rollback 003_phase1_observability_foundation
-- WARNING: deletes all Phase 1 observability data.
-- Take a backup before running in production.

-- Views first
drop view if exists public.v_observability_latest_discovery_run;
drop view if exists public.v_observability_discovery_summary;
drop view if exists public.v_observability_measurement_summary;
drop view if exists public.v_observability_watchlist_summary;

-- New tables (RLS drops with table)
drop table if exists public.ranking_snapshots;
drop table if exists public.discovery_runs;
drop table if exists public.measurement_schedule;
drop table if exists public.candidate_discoveries;
drop table if exists public.channel_watchlist;

-- Revert videos extensions
alter table public.videos
  drop constraint if exists videos_duration_seconds_nonneg;

alter table public.videos
  drop column if exists last_observed_at,
  drop column if exists first_discovered_at,
  drop column if exists is_topic_content,
  drop column if exists is_live,
  drop column if exists is_short,
  drop column if exists duration_seconds;

-- Revert channels extensions
alter table public.channels
  drop constraint if exists channels_market_relevance_range;

alter table public.channels
  drop column if exists last_upload_at,
  drop column if exists default_language,
  drop column if exists country,
  drop column if exists market_relevance,
  drop column if exists channel_type;

-- Verify rollback
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'channel_watchlist', 'candidate_discoveries',
    'measurement_schedule', 'discovery_runs', 'ranking_snapshots'
  );
-- Expect 0 rows.
