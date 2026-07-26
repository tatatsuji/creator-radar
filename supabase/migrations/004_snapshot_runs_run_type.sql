-- Phase 2.5/3 prep: explicit snapshot_runs.run_type (dev apply only)
-- Allowed values: legacy_snapshot, measurement (NULL = unknown/unclassified)

alter table public.snapshot_runs
  add column if not exists run_type text;

-- Measurement runs identified by JSON marker or zero-channel measurement pattern
update public.snapshot_runs
set run_type = 'measurement'
where run_type is null
  and error_summary like '%"type":"measurement"%';

-- Legacy runs that processed channels
update public.snapshot_runs
set run_type = 'legacy_snapshot'
where run_type is null
  and channels_total > 0;

-- Legacy runs still in progress (no error_summary marker)
update public.snapshot_runs
set run_type = 'legacy_snapshot'
where run_type is null
  and status = 'running'
  and error_summary is null;

-- Ambiguous finished rows with channels_total = 0 and no marker remain NULL

alter table public.snapshot_runs
  drop constraint if exists snapshot_runs_run_type_check;

alter table public.snapshot_runs
  add constraint snapshot_runs_run_type_check
  check (run_type is null or run_type in ('legacy_snapshot', 'measurement'));

create index if not exists idx_snapshot_runs_run_type_started_at
  on public.snapshot_runs (run_type, started_at desc);
