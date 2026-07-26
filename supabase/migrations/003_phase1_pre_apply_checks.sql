-- Run manually BEFORE applying 003_phase1_observability_foundation.sql
-- All checks should pass; investigate any failure before migrating.

-- ---------------------------------------------------------------------------
-- A. Prerequisites: gen_random_uuid()
-- ---------------------------------------------------------------------------
-- Supabase PG 15+ provides gen_random_uuid() without extra setup.
-- This must succeed (same function used in 001/002):
select gen_random_uuid() as gen_random_uuid_smoke_test;

-- If the above fails, inspect extensions (do NOT auto-install in production):
select extname, extversion
from pg_extension
where extname in ('pgcrypto', 'uuid-ossp');

-- Fallback guidance (apply only if smoke test fails AND extension is missing):
--   create extension if not exists pgcrypto;
-- Re-run smoke test after explicit approval.

-- ---------------------------------------------------------------------------
-- B. Existing schema intact
-- ---------------------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'videos', 'channels', 'video_snapshots',
    'channel_snapshots', 'snapshot_runs'
  )
order by table_name;
-- Expect 5 rows.

-- ---------------------------------------------------------------------------
-- C. Columns that must NOT be duplicated by 003
-- ---------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'channels' and column_name = 'updated_at')
    or (table_name = 'videos' and column_name in ('updated_at', 'last_seen_at'))
    or (table_name = 'video_snapshots' and column_name in (
      'view_count', 'like_count', 'comment_count', 'captured_at'
    ))
  )
order by table_name, column_name;

-- ---------------------------------------------------------------------------
-- D. 003 target columns must NOT already exist
-- ---------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'videos' and column_name = 'last_observed_at')
    or (table_name = 'channels' and column_name = 'channel_type')
    or table_name in (
      'channel_watchlist', 'candidate_discoveries',
      'measurement_schedule', 'discovery_runs', 'ranking_snapshots'
    )
  );
-- Expect 0 rows on first apply.

-- ---------------------------------------------------------------------------
-- E. No existing updated_at trigger (confirms repository-manual pattern)
-- ---------------------------------------------------------------------------
select event_object_table, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and action_statement ilike '%updated_at%';
-- Expect 0 rows (Phase 1 will NOT add triggers).

-- ---------------------------------------------------------------------------
-- F. Baseline row counts (record before migration)
-- ---------------------------------------------------------------------------
select 'videos' as tbl, count(*)::bigint as row_count from public.videos
union all
select 'channels', count(*)::bigint from public.channels
union all
select 'video_snapshots', count(*)::bigint from public.video_snapshots
union all
select 'channel_snapshots', count(*)::bigint from public.channel_snapshots
union all
select 'snapshot_runs', count(*)::bigint from public.snapshot_runs;

-- ---------------------------------------------------------------------------
-- G. Existing RLS state (do not change existing tables)
-- ---------------------------------------------------------------------------
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'videos', 'channels', 'video_snapshots',
    'channel_snapshots', 'snapshot_runs'
  )
order by c.relname;
-- Record current values; 003 must not ALTER these tables' RLS.
