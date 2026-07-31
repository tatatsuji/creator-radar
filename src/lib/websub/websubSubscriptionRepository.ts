import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { computeWebsubSubscriptionHealth } from "@/lib/websub/websubSubscribeHealth";
import { buildWebsubTopicUrl, isValidWebsubTopicUrl } from "@/lib/websub/websubTopic";
import type { WebsubCanaryWatchlistCandidate } from "@/lib/websub/websubCanaryPolicy";
import { getWebsubCallbackUrl, WEBSUB_CONFIG } from "@/lib/websub/websubConfig";
import type {
  WebsubSubscriptionHealth,
  WebsubSubscriptionStatus,
} from "@/types/observability";

export interface WebsubSubscriptionRow {
  id: string;
  youtube_channel_id: string;
  topic_url: string;
  status: string;
}

export interface WebsubSubscriptionRecord {
  id: string;
  youtube_channel_id: string;
  topic_url: string;
  hub_url: string;
  callback_url: string;
  status: WebsubSubscriptionStatus | string;
  subscription_health: WebsubSubscriptionHealth | string;
  lease_expires_at: string | null;
  secret_version: number;
  subscribe_attempt_count: number;
  last_subscribe_at: string | null;
  last_verified_at: string | null;
  last_notification_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const LIVE_SUBSCRIPTION_STATUSES = [
  "pending",
  "pending_verify",
  "active",
  "renew_failed",
] as const;

const SUBSCRIPTION_SELECT =
  "id,youtube_channel_id,topic_url,hub_url,callback_url,status,subscription_health,lease_expires_at,secret_version,subscribe_attempt_count,last_subscribe_at,last_verified_at,last_notification_at,last_error,created_at,updated_at";

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

export async function getWebsubSubscriptionByChannelId(
  youtubeChannelId: string,
): Promise<WebsubSubscriptionRecord | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data: liveData, error: liveError } = await supabase
    .from("websub_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("youtube_channel_id", youtubeChannelId)
    .in("status", [...LIVE_SUBSCRIPTION_STATUSES])
    .maybeSingle();

  if (liveError) {
    throw new Error(
      `websub_subscriptions channel lookup failed: ${liveError.message}`,
    );
  }

  if (liveData) {
    return liveData as WebsubSubscriptionRecord;
  }

  const { data, error } = await supabase
    .from("websub_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("youtube_channel_id", youtubeChannelId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `websub_subscriptions channel lookup failed: ${error.message}`,
    );
  }

  return (data as WebsubSubscriptionRecord | null) ?? null;
}

export async function findWebsubSubscriptionByTopic(
  topicUrl: string,
): Promise<WebsubSubscriptionRow | null> {
  if (!isSupabaseConfigured() || !isValidWebsubTopicUrl(topicUrl)) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("websub_subscriptions")
    .select("id,youtube_channel_id,topic_url,status")
    .eq("topic_url", topicUrl)
    .maybeSingle();

  if (error) {
    throw new Error(`websub_subscriptions lookup failed: ${error.message}`);
  }

  return data ?? null;
}

export async function listWatchlistChannelsForWebsub(): Promise<
  WebsubCanaryWatchlistCandidate[]
> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("channel_id, watch_tier, watch_status")
    .neq("watch_tier", "archive")
    .in("watch_status", ["seed", "discovered", "active"]);

  if (error) {
    throw new Error(`channel_watchlist lookup failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    channelId: row.channel_id as string,
    watchTier: row.watch_tier as string,
  }));
}

export async function listWatchlistChannelIdsEligibleForWebsub(): Promise<
  string[]
> {
  const channels = await listWatchlistChannelsForWebsub();
  return channels.map((channel) => channel.channelId);
}

export async function listLiveWebsubSubscriptions(): Promise<
  WebsubSubscriptionRecord[]
> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("websub_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .in("status", [...LIVE_SUBSCRIPTION_STATUSES]);

  if (error) {
    throw new Error(`websub_subscriptions list failed: ${error.message}`);
  }

  return (data ?? []) as WebsubSubscriptionRecord[];
}

export async function listWebsubSubscriptionsForReconcile(): Promise<
  WebsubSubscriptionRecord[]
> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("websub_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .in("status", [
      "pending",
      "pending_verify",
      "active",
      "renew_failed",
      "expired",
      "orphaned",
    ]);

  if (error) {
    throw new Error(
      `websub_subscriptions reconcile list failed: ${error.message}`,
    );
  }

  return (data ?? []) as WebsubSubscriptionRecord[];
}

export async function createWebsubSubscriptionForChannel(
  youtubeChannelId: string,
): Promise<WebsubSubscriptionRecord> {
  assertSupabaseConfigured();

  const topicUrl = buildWebsubTopicUrl(youtubeChannelId);
  const callbackUrl = getWebsubCallbackUrl();
  const now = new Date().toISOString();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("websub_subscriptions")
    .insert({
      youtube_channel_id: youtubeChannelId,
      topic_url: topicUrl,
      hub_url: WEBSUB_CONFIG.hubUrl,
      callback_url: callbackUrl,
      status: "pending",
      subscription_health: "unhealthy",
      updated_at: now,
    })
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error) {
    throw new Error(`websub_subscriptions insert failed: ${error.message}`);
  }

  return data as WebsubSubscriptionRecord;
}

export async function markWebsubSubscribePostSuccess(input: {
  id: string;
  subscribedAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const subscribedAt = input.subscribedAt ?? new Date();
  const supabase = createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("websub_subscriptions")
    .select("subscribe_attempt_count")
    .eq("id", input.id)
    .single();

  if (readError) {
    throw new Error(
      `websub_subscriptions subscribe success read failed: ${readError.message}`,
    );
  }

  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "pending_verify",
      subscription_health: "unhealthy",
      last_subscribe_at: subscribedAt.toISOString(),
      subscribe_attempt_count: (existing?.subscribe_attempt_count ?? 0) + 1,
      last_error: null,
      updated_at: subscribedAt.toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(
      `websub_subscriptions subscribe success update failed: ${error.message}`,
    );
  }
}

export async function markWebsubSubscribePostFailure(input: {
  id: string;
  errorMessage: string;
  failedAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const failedAt = input.failedAt ?? new Date();
  const supabase = createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("websub_subscriptions")
    .select("subscribe_attempt_count")
    .eq("id", input.id)
    .single();

  if (readError) {
    throw new Error(
      `websub_subscriptions subscribe failure read failed: ${readError.message}`,
    );
  }

  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "renew_failed",
      subscription_health: "degraded",
      subscribe_attempt_count: (existing?.subscribe_attempt_count ?? 0) + 1,
      last_subscribe_at: failedAt.toISOString(),
      last_error: input.errorMessage,
      updated_at: failedAt.toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(
      `websub_subscriptions subscribe failure update failed: ${error.message}`,
    );
  }
}

export async function updateWebsubSubscriptionHealth(input: {
  id: string;
  subscriptionHealth: WebsubSubscriptionHealth;
  status?: WebsubSubscriptionStatus;
  updatedAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const updatedAt = input.updatedAt ?? new Date();
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    subscription_health: input.subscriptionHealth,
    updated_at: updatedAt.toISOString(),
  };

  if (input.status) {
    payload.status = input.status;
  }

  const { error } = await supabase
    .from("websub_subscriptions")
    .update(payload)
    .eq("id", input.id);

  if (error) {
    throw new Error(
      `websub_subscriptions health update failed: ${error.message}`,
    );
  }
}

export async function markWebsubSubscriptionExpired(input: {
  id: string;
  expiredAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const expiredAt = input.expiredAt ?? new Date();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "expired",
      subscription_health: "unhealthy",
      updated_at: expiredAt.toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`websub_subscriptions expire failed: ${error.message}`);
  }
}

export async function markWebsubSubscriptionDead(input: {
  id: string;
  reason: string;
  deadAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const deadAt = input.deadAt ?? new Date();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "dead",
      subscription_health: "unhealthy",
      last_error: input.reason,
      updated_at: deadAt.toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`websub_subscriptions dead update failed: ${error.message}`);
  }
}

export async function markWebsubSubscriptionOrphaned(input: {
  id: string;
  orphanedAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const orphanedAt = input.orphanedAt ?? new Date();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "orphaned",
      subscription_health: "unhealthy",
      updated_at: orphanedAt.toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(
      `websub_subscriptions orphan update failed: ${error.message}`,
    );
  }
}

export function deriveWebsubSubscriptionHealth(
  subscription: Pick<
    WebsubSubscriptionRecord,
    "status" | "lease_expires_at" | "last_verified_at"
  >,
  now?: Date,
): WebsubSubscriptionHealth {
  return computeWebsubSubscriptionHealth({
    status: subscription.status,
    leaseExpiresAt: subscription.lease_expires_at,
    lastVerifiedAt: subscription.last_verified_at,
    now,
  });
}

export async function applyWebsubHubVerification(input: {
  topicUrl: string;
  mode: "subscribe" | "unsubscribe";
  leaseSeconds?: number;
  verifiedAt?: Date;
}): Promise<void> {
  assertSupabaseConfigured();

  const verifiedAt = input.verifiedAt ?? new Date();
  const supabase = createSupabaseServerClient();

  if (input.mode === "unsubscribe") {
    const { error } = await supabase
      .from("websub_subscriptions")
      .update({
        status: "unsubscribed",
        subscription_health: "unhealthy",
        last_verified_at: verifiedAt.toISOString(),
        updated_at: verifiedAt.toISOString(),
      })
      .eq("topic_url", input.topicUrl);

    if (error) {
      throw new Error(`websub_subscriptions unsubscribe failed: ${error.message}`);
    }

    return;
  }

  const leaseSeconds = input.leaseSeconds ?? 0;
  const leaseExpiresAt = new Date(verifiedAt.getTime() + leaseSeconds * 1000);
  const subscriptionHealth = computeWebsubSubscriptionHealth({
    status: "active",
    leaseExpiresAt: leaseExpiresAt.toISOString(),
    lastVerifiedAt: verifiedAt.toISOString(),
    now: verifiedAt,
  });

  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "active",
      lease_expires_at: leaseExpiresAt.toISOString(),
      last_verified_at: verifiedAt.toISOString(),
      subscription_health: subscriptionHealth,
      subscribe_attempt_count: 0,
      last_error: null,
      updated_at: verifiedAt.toISOString(),
    })
    .eq("topic_url", input.topicUrl);

  if (error) {
    throw new Error(`websub_subscriptions verification failed: ${error.message}`);
  }
}
