-- Phase 13.1: one pending deferred operation per operation_type.
create unique index if not exists quota_deferred_operations_one_pending_per_operation
  on public.quota_deferred_operations (operation_type)
  where status = 'pending';

create index if not exists quota_deferred_operations_terminal_updated_idx
  on public.quota_deferred_operations (status, updated_at)
  where status in ('completed', 'cancelled');
