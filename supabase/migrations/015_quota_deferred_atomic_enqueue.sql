-- Phase 13.2: atomic enqueue via INSERT ... ON CONFLICT using migration 014 partial unique index.
create or replace function public.enqueue_quota_deferred_operation(
  p_operation_type text,
  p_payload jsonb,
  p_estimated_units integer,
  p_priority integer,
  p_reason text,
  p_retry_after timestamptz,
  p_max_attempts integer default 48
)
returns table (
  id uuid,
  status text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  return query
  insert into public.quota_deferred_operations (
    operation_type,
    payload,
    estimated_units,
    priority,
    reason,
    retry_after,
    attempt_count,
    max_attempts,
    status,
    updated_at
  )
  values (
    p_operation_type,
    coalesce(p_payload, '{}'::jsonb),
    p_estimated_units,
    p_priority,
    p_reason,
    p_retry_after,
    1,
    p_max_attempts,
    'pending',
    v_now
  )
  on conflict (operation_type) where (status = 'pending')
  do update set
    estimated_units = excluded.estimated_units,
    priority = excluded.priority,
    reason = excluded.reason,
    payload = excluded.payload,
    retry_after = excluded.retry_after,
    updated_at = v_now,
    attempt_count = quota_deferred_operations.attempt_count + 1,
    status = case
      when quota_deferred_operations.attempt_count + 1 >= quota_deferred_operations.max_attempts
      then 'cancelled'
      else 'pending'
    end
  returning
    quota_deferred_operations.id,
    quota_deferred_operations.status,
    quota_deferred_operations.attempt_count;
end;
$$;

revoke all on function public.enqueue_quota_deferred_operation(
  text,
  jsonb,
  integer,
  integer,
  text,
  timestamptz,
  integer
) from public;

grant execute on function public.enqueue_quota_deferred_operation(
  text,
  jsonb,
  integer,
  integer,
  text,
  timestamptz,
  integer
) to service_role;
