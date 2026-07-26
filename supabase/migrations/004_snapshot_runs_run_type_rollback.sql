-- Rollback for 004_snapshot_runs_run_type.sql

drop index if exists public.idx_snapshot_runs_run_type_started_at;

alter table public.snapshot_runs
  drop constraint if exists snapshot_runs_run_type_check;

alter table public.snapshot_runs
  drop column if exists run_type;
