-- Phase 2 Step 1: WebSub subscriptions, notification queue, and atomic RPCs.

-- ---------------------------------------------------------------------------
-- 1. websub_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.websub_subscriptions (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null
    references public.channels (youtube_channel_id) on delete cascade,
  topic_url text not null,
  hub_url text not null default 'https://pubsubhubbub.appspot.com/subscribe',
  callback_url text not null,
  status text not null default 'pending',
  subscription_health text not null default 'unhealthy',
  lease_expires_at timestamptz,
  secret_version integer not null default 1,
  subscribe_attempt_count integer not null default 0,
  last_subscribe_at timestamptz,
  last_verified_at timestamptz,
  last_notification_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint websub_subscriptions_status_check
    check (status in (
      'pending',
      'pending_verify',
      'active',
      'renew_failed',
      'expired',
      'unsubscribed',
      'orphaned',
      'dead'
    )),

  constraint websub_subscriptions_health_check
    check (subscription_health in ('healthy', 'degraded', 'unhealthy')),

  constraint websub_subscriptions_secret_version_positive
    check (secret_version > 0),

  constraint websub_subscriptions_subscribe_attempt_count_nonneg
    check (subscribe_attempt_count >= 0)
);

create unique index if not exists websub_subscriptions_one_live_per_channel
  on public.websub_subscriptions (youtube_channel_id)
  where status in ('pending', 'pending_verify', 'active', 'renew_failed');

create index if not exists websub_subscriptions_status_lease_idx
  on public.websub_subscriptions (status, lease_expires_at);

create index if not exists websub_subscriptions_health_status_idx
  on public.websub_subscriptions (subscription_health, status);

-- ---------------------------------------------------------------------------
-- 2. websub_notification_log
-- ---------------------------------------------------------------------------
create table if not exists public.websub_notification_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid
    references public.websub_subscriptions (id) on delete set null,
  dedup_key text not null,
  topic_url text not null,
  youtube_video_id text not null,
  youtube_channel_id text not null,
  entry_updated_at timestamptz,
  hub_notification_id text,
  status text not null default 'pending',
  processing_owner text,
  processing_expires_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  quota_units_used integer not null default 0,
  discovery_run_id uuid
    references public.discovery_runs (id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint websub_notification_log_dedup_key_unique unique (dedup_key),

  constraint websub_notification_log_status_check
    check (status in (
      'pending',
      'processing',
      'processed',
      'skipped_known',
      'duplicate',
      'failed',
      'dead'
    )),

  constraint websub_notification_log_attempt_count_nonneg
    check (attempt_count >= 0),

  constraint websub_notification_log_max_attempts_positive
    check (max_attempts > 0),

  constraint websub_notification_log_quota_units_used_nonneg
    check (quota_units_used >= 0)
);

create unique index if not exists websub_notification_log_topic_video_unique
  on public.websub_notification_log (topic_url, youtube_video_id);

create index if not exists websub_notification_log_pending_idx
  on public.websub_notification_log (status, received_at)
  where status in ('pending', 'processing');

create index if not exists websub_notification_log_processing_lease_idx
  on public.websub_notification_log (processing_expires_at)
  where status = 'processing';

-- ---------------------------------------------------------------------------
-- 3. enqueue_websub_notification — atomic UPSERT on dedup_key
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_websub_notification(
  p_subscription_id uuid,
  p_topic_url text,
  p_youtube_video_id text,
  p_youtube_channel_id text,
  p_entry_updated_at timestamptz default null,
  p_hub_notification_id text default null
)
returns table (
  id uuid,
  status text,
  is_new boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dedup_key text := p_topic_url || '::' || p_youtube_video_id;
  v_now timestamptz := now();
  v_existing_status text;
  v_row_id uuid;
  v_row_status text;
  v_is_new boolean := false;
begin
  select websub_notification_log.status, websub_notification_log.id
    into v_existing_status, v_row_id
  from public.websub_notification_log
  where websub_notification_log.dedup_key = v_dedup_key;

  if not found then
    insert into public.websub_notification_log (
      subscription_id,
      dedup_key,
      topic_url,
      youtube_video_id,
      youtube_channel_id,
      entry_updated_at,
      hub_notification_id,
      status,
      received_at,
      updated_at
    )
    values (
      p_subscription_id,
      v_dedup_key,
      p_topic_url,
      p_youtube_video_id,
      p_youtube_channel_id,
      p_entry_updated_at,
      p_hub_notification_id,
      'pending',
      v_now,
      v_now
    )
    returning websub_notification_log.id, websub_notification_log.status
      into v_row_id, v_row_status;

    v_is_new := true;
    return query select v_row_id, v_row_status, v_is_new;
    return;
  end if;

  update public.websub_notification_log
  set
    subscription_id = coalesce(p_subscription_id, websub_notification_log.subscription_id),
    entry_updated_at = case
      when p_entry_updated_at is null then websub_notification_log.entry_updated_at
      when websub_notification_log.entry_updated_at is null then p_entry_updated_at
      else greatest(websub_notification_log.entry_updated_at, p_entry_updated_at)
    end,
    hub_notification_id = coalesce(p_hub_notification_id, websub_notification_log.hub_notification_id),
    received_at = v_now,
    updated_at = v_now,
    status = case
      when websub_notification_log.status in ('processed', 'skipped_known', 'duplicate')
        then websub_notification_log.status
      when websub_notification_log.status = 'failed'
        then 'pending'
      else websub_notification_log.status
    end
  where websub_notification_log.dedup_key = v_dedup_key
  returning websub_notification_log.id, websub_notification_log.status
    into v_row_id, v_row_status;

  return query select v_row_id, v_row_status, v_is_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. claim_websub_notifications — SKIP LOCKED + processing lease
-- ---------------------------------------------------------------------------
create or replace function public.claim_websub_notifications(
  p_worker_id text,
  p_batch_size integer default 50,
  p_processing_lease_seconds integer default 600
)
returns setof public.websub_notification_log
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select websub_notification_log.id
    from public.websub_notification_log
    where websub_notification_log.status = 'pending'
       or (
         websub_notification_log.status = 'processing'
         and websub_notification_log.processing_expires_at < now()
       )
    order by websub_notification_log.received_at asc
    limit p_batch_size
    for update skip locked
  )
  update public.websub_notification_log as w
  set
    status = 'processing',
    processing_owner = p_worker_id,
    processing_expires_at = now() + make_interval(secs => p_processing_lease_seconds),
    updated_at = now()
  from candidates c
  where w.id = c.id
  returning w.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. complete_websub_notification
-- ---------------------------------------------------------------------------
create or replace function public.complete_websub_notification(
  p_id uuid,
  p_status text,
  p_quota_units_used integer default 0,
  p_discovery_run_id uuid default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.websub_notification_log
  set
    status = p_status,
    quota_units_used = p_quota_units_used,
    discovery_run_id = p_discovery_run_id,
    error_message = p_error_message,
    processed_at = now(),
    processing_owner = null,
    processing_expires_at = null,
    updated_at = now()
  where websub_notification_log.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. reclaim_stale_websub_notifications
-- ---------------------------------------------------------------------------
create or replace function public.reclaim_stale_websub_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.websub_notification_log
  set
    status = 'pending',
    processing_owner = null,
    processing_expires_at = null,
    updated_at = now()
  where websub_notification_log.status = 'processing'
    and websub_notification_log.processing_expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.websub_subscriptions enable row level security;
alter table public.websub_notification_log enable row level security;

revoke all on public.websub_subscriptions from anon, authenticated;
revoke all on public.websub_notification_log from anon, authenticated;

revoke all on function public.enqueue_websub_notification(
  uuid, text, text, text, timestamptz, text
) from public;

revoke all on function public.claim_websub_notifications(
  text, integer, integer
) from public;

revoke all on function public.complete_websub_notification(
  uuid, text, integer, uuid, text
) from public;

revoke all on function public.reclaim_stale_websub_notifications() from public;

grant execute on function public.enqueue_websub_notification(
  uuid, text, text, text, timestamptz, text
) to service_role;

grant execute on function public.claim_websub_notifications(
  text, integer, integer
) to service_role;

grant execute on function public.complete_websub_notification(
  uuid, text, integer, uuid, text
) to service_role;

grant execute on function public.reclaim_stale_websub_notifications() to service_role;
