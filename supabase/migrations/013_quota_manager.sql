-- Phase 13: Quota Manager deferred queue.
create table if not exists public.quota_deferred_operations (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null,
  payload jsonb not null default '{}'::jsonb,
  estimated_units integer not null,
  priority integer not null,
  reason text not null,
  deferred_at timestamptz not null default now(),
  retry_after timestamptz not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 48,
  status text not null default 'pending',
  updated_at timestamptz not null default now(),
  constraint quota_deferred_operations_estimated_units_positive
    check (estimated_units > 0),
  constraint quota_deferred_operations_status_check
    check (status in ('pending', 'processing', 'completed', 'cancelled')),
  constraint quota_deferred_operations_operation_type_check
    check (
      operation_type in (
        'measurement_critical',
        'measurement_high',
        'measurement_normal',
        'measurement_low',
        'measurement_archive',
        'measurement_run',
        'watchlist_discovery',
        'candidate_discovery',
        'emergency_discovery',
        'auto_watchlist'
      )
    )
);

create index if not exists quota_deferred_operations_pending_idx
  on public.quota_deferred_operations (operation_type, status, retry_after, priority desc);

alter table public.quota_deferred_operations enable row level security;
revoke all on public.quota_deferred_operations from anon, authenticated;
