import {
  postWebsubHubRequest,
  type PostWebsubHubRequestResult,
} from "@/lib/websub/websubHubClient";
import {
  getWebsubCallbackUrl,
  isWebsubEnabled,
  WEBSUB_CONFIG,
} from "@/lib/websub/websubConfig";
import {
  createWebsubSubscriptionForChannel,
  deriveWebsubSubscriptionHealth,
  listLiveWebsubSubscriptions,
  listWatchlistChannelIdsEligibleForWebsub,
  listWebsubSubscriptionsForReconcile,
  markWebsubSubscribePostFailure,
  markWebsubSubscribePostSuccess,
  markWebsubSubscriptionDead,
  markWebsubSubscriptionExpired,
  markWebsubSubscriptionOrphaned,
  updateWebsubSubscriptionHealth,
  type WebsubSubscriptionRecord,
} from "@/lib/websub/websubSubscriptionRepository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type WebsubSubscribeManagerOperation =
  | "subscribe_new"
  | "renew_urgent"
  | "renew_daily"
  | "reconcile";

export interface WebsubSubscribeManagerResult {
  status: "executed" | "skipped";
  operation: WebsubSubscribeManagerOperation;
  attempted: number;
  succeeded: number;
  failed: number;
  healthUpdated: number;
  expired: number;
  orphaned: number;
  dead: number;
  resubscribed: number;
}

export interface WebsubSubscribeManagerDeps {
  isEnabled: () => boolean;
  isSupabaseReady: () => boolean;
  listWatchlistChannelIds: () => Promise<string[]>;
  listLiveSubscriptions: () => Promise<WebsubSubscriptionRecord[]>;
  listReconcileSubscriptions: () => Promise<WebsubSubscriptionRecord[]>;
  createSubscription: (youtubeChannelId: string) => Promise<WebsubSubscriptionRecord>;
  markSubscribeSuccess: (input: { id: string; subscribedAt?: Date }) => Promise<void>;
  markSubscribeFailure: (input: {
    id: string;
    errorMessage: string;
    failedAt?: Date;
  }) => Promise<void>;
  updateHealth: (input: {
    id: string;
    subscriptionHealth: ReturnType<typeof deriveWebsubSubscriptionHealth>;
    status?: "expired" | "orphaned" | "dead";
  }) => Promise<void>;
  markExpired: (input: { id: string; expiredAt?: Date }) => Promise<void>;
  markOrphaned: (input: { id: string; orphanedAt?: Date }) => Promise<void>;
  markDead: (input: {
    id: string;
    reason: string;
    deadAt?: Date;
  }) => Promise<void>;
  postHubSubscribe: (subscription: WebsubSubscriptionRecord) => Promise<PostWebsubHubRequestResult>;
  getCallbackUrl: () => string;
  now: () => Date;
  config: {
    subscribeBatchLimit: number;
    subscribeConcurrency: number;
    leaseRequestSeconds: number;
    hubSecret: string;
    pendingVerifyStaleMs: number;
    maxSubscribeAttempts: number;
    urgentRenewWithinMs: number;
    dailyRenewWithinMs: number;
  };
}

const defaultDeps: WebsubSubscribeManagerDeps = {
  isEnabled: isWebsubEnabled,
  isSupabaseReady: isSupabaseConfigured,
  listWatchlistChannelIds: listWatchlistChannelIdsEligibleForWebsub,
  listLiveSubscriptions: listLiveWebsubSubscriptions,
  listReconcileSubscriptions: listWebsubSubscriptionsForReconcile,
  createSubscription: createWebsubSubscriptionForChannel,
  markSubscribeSuccess: markWebsubSubscribePostSuccess,
  markSubscribeFailure: markWebsubSubscribePostFailure,
  updateHealth: async (input) =>
    updateWebsubSubscriptionHealth({
      id: input.id,
      subscriptionHealth: input.subscriptionHealth,
      status: input.status,
    }),
  markExpired: markWebsubSubscriptionExpired,
  markOrphaned: markWebsubSubscriptionOrphaned,
  markDead: markWebsubSubscriptionDead,
  postHubSubscribe: async (subscription) =>
    postWebsubHubRequest({
      hubUrl: subscription.hub_url,
      mode: "subscribe",
      topicUrl: subscription.topic_url,
      callbackUrl: subscription.callback_url,
      leaseSeconds: WEBSUB_CONFIG.leaseRequestSeconds,
      secret: WEBSUB_CONFIG.hubSecret || undefined,
    }),
  getCallbackUrl: getWebsubCallbackUrl,
  now: () => new Date(),
  config: {
    subscribeBatchLimit: WEBSUB_CONFIG.subscribeBatchLimit,
    subscribeConcurrency: WEBSUB_CONFIG.subscribeConcurrency,
    leaseRequestSeconds: WEBSUB_CONFIG.leaseRequestSeconds,
    hubSecret: WEBSUB_CONFIG.hubSecret,
    pendingVerifyStaleMs: WEBSUB_CONFIG.pendingVerifyStaleMs,
    maxSubscribeAttempts: WEBSUB_CONFIG.maxSubscribeAttempts,
    urgentRenewWithinMs: WEBSUB_CONFIG.urgentRenewWithinMs,
    dailyRenewWithinMs: WEBSUB_CONFIG.dailyRenewWithinMs,
  },
};

function createEmptyResult(
  operation: WebsubSubscribeManagerOperation,
  status: WebsubSubscribeManagerResult["status"] = "executed",
): WebsubSubscribeManagerResult {
  return {
    status,
    operation,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    healthUpdated: 0,
    expired: 0,
    orphaned: 0,
    dead: 0,
    resubscribed: 0,
  };
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let index = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        await worker(items[currentIndex]!);
      }
    },
  );

  await Promise.all(runners);
}

async function sendSubscribeForSubscriptions(
  subscriptions: WebsubSubscriptionRecord[],
  deps: WebsubSubscribeManagerDeps,
  result: WebsubSubscribeManagerResult,
): Promise<void> {
  const batch = subscriptions.slice(0, deps.config.subscribeBatchLimit);
  result.attempted = batch.length;

  await mapWithConcurrency(batch, deps.config.subscribeConcurrency, async (subscription) => {
    try {
      const hubResult = await deps.postHubSubscribe(subscription);
      if (hubResult.ok) {
        await deps.markSubscribeSuccess({
          id: subscription.id,
          subscribedAt: deps.now(),
        });
        result.succeeded += 1;
        return;
      }

      await deps.markSubscribeFailure({
        id: subscription.id,
        errorMessage: `Hub subscribe failed (${hubResult.status}): ${hubResult.body}`,
        failedAt: deps.now(),
      });
      result.failed += 1;
    } catch (error) {
      await deps.markSubscribeFailure({
        id: subscription.id,
        errorMessage:
          error instanceof Error ? error.message : "Hub subscribe request failed",
        failedAt: deps.now(),
      });
      result.failed += 1;
    }
  });
}

function isLeaseExpiringWithin(
  subscription: WebsubSubscriptionRecord,
  withinMs: number,
  now: Date,
): boolean {
  if (subscription.status !== "active" || !subscription.lease_expires_at) {
    return false;
  }

  const leaseExpiresAtMs = new Date(subscription.lease_expires_at).getTime();
  return leaseExpiresAtMs <= now.getTime() + withinMs;
}

function isPendingVerifyStale(
  subscription: WebsubSubscriptionRecord,
  staleMs: number,
  now: Date,
): boolean {
  if (subscription.status !== "pending_verify" || !subscription.last_subscribe_at) {
    return false;
  }

  return (
    new Date(subscription.last_subscribe_at).getTime() <=
    now.getTime() - staleMs
  );
}

function shouldExpireSubscription(
  subscription: WebsubSubscriptionRecord,
  maxAttempts: number,
): boolean {
  return subscription.subscribe_attempt_count >= maxAttempts;
}

export async function runWebsubSubscribeNew(
  deps: Partial<WebsubSubscribeManagerDeps> = {},
): Promise<WebsubSubscribeManagerResult> {
  const resolvedDeps = { ...defaultDeps, ...deps, config: { ...defaultDeps.config, ...deps.config } };
  const result = createEmptyResult("subscribe_new");

  if (!resolvedDeps.isEnabled()) {
    return createEmptyResult("subscribe_new", "skipped");
  }

  if (!resolvedDeps.isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  resolvedDeps.getCallbackUrl();

  const [watchlistChannelIds, liveSubscriptions] = await Promise.all([
    resolvedDeps.listWatchlistChannelIds(),
    resolvedDeps.listLiveSubscriptions(),
  ]);

  const liveByChannelId = new Map(
    liveSubscriptions.map((subscription) => [
      subscription.youtube_channel_id,
      subscription,
    ]),
  );

  const targets: WebsubSubscriptionRecord[] = [];

  for (const channelId of watchlistChannelIds) {
    const existing = liveByChannelId.get(channelId);
    if (!existing) {
      targets.push(await resolvedDeps.createSubscription(channelId));
      continue;
    }

    if (existing.status === "pending") {
      targets.push(existing);
    }
  }

  await sendSubscribeForSubscriptions(targets, resolvedDeps, result);
  return result;
}

export async function runWebsubRenewUrgent(
  deps: Partial<WebsubSubscribeManagerDeps> = {},
): Promise<WebsubSubscribeManagerResult> {
  const resolvedDeps = { ...defaultDeps, ...deps, config: { ...defaultDeps.config, ...deps.config } };
  const result = createEmptyResult("renew_urgent");

  if (!resolvedDeps.isEnabled()) {
    return createEmptyResult("renew_urgent", "skipped");
  }

  if (!resolvedDeps.isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const now = resolvedDeps.now();
  const subscriptions = (await resolvedDeps.listLiveSubscriptions()).filter(
    (subscription) =>
      isLeaseExpiringWithin(
        subscription,
        resolvedDeps.config.urgentRenewWithinMs,
        now,
      ),
  );

  await sendSubscribeForSubscriptions(subscriptions, resolvedDeps, result);
  return result;
}

export async function runWebsubRenewDaily(
  deps: Partial<WebsubSubscribeManagerDeps> = {},
): Promise<WebsubSubscribeManagerResult> {
  const resolvedDeps = { ...defaultDeps, ...deps, config: { ...defaultDeps.config, ...deps.config } };
  const result = createEmptyResult("renew_daily");

  if (!resolvedDeps.isEnabled()) {
    return createEmptyResult("renew_daily", "skipped");
  }

  if (!resolvedDeps.isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const now = resolvedDeps.now();
  const subscriptions = (await resolvedDeps.listLiveSubscriptions()).filter(
    (subscription) =>
      isLeaseExpiringWithin(
        subscription,
        resolvedDeps.config.dailyRenewWithinMs,
        now,
      ),
  );

  await sendSubscribeForSubscriptions(subscriptions, resolvedDeps, result);
  return result;
}

export async function runWebsubReconcile(
  deps: Partial<WebsubSubscribeManagerDeps> = {},
): Promise<WebsubSubscribeManagerResult> {
  const resolvedDeps = { ...defaultDeps, ...deps, config: { ...defaultDeps.config, ...deps.config } };
  const result = createEmptyResult("reconcile");

  if (!resolvedDeps.isEnabled()) {
    return createEmptyResult("reconcile", "skipped");
  }

  if (!resolvedDeps.isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const now = resolvedDeps.now();
  const [watchlistChannelIds, subscriptions] = await Promise.all([
    resolvedDeps.listWatchlistChannelIds(),
    resolvedDeps.listReconcileSubscriptions(),
  ]);
  const watchlistSet = new Set(watchlistChannelIds);
  const resubscribeTargets: WebsubSubscriptionRecord[] = [];

  for (const subscription of subscriptions) {
    if (
      subscription.status !== "dead" &&
      subscription.status !== "unsubscribed" &&
      subscription.status !== "orphaned" &&
      !watchlistSet.has(subscription.youtube_channel_id)
    ) {
      await resolvedDeps.markOrphaned({
        id: subscription.id,
        orphanedAt: now,
      });
      result.orphaned += 1;
      continue;
    }

    if (
      subscription.status !== "expired" &&
      subscription.status !== "dead" &&
      shouldExpireSubscription(
        subscription,
        resolvedDeps.config.maxSubscribeAttempts,
      )
    ) {
      await resolvedDeps.markExpired({
        id: subscription.id,
        expiredAt: now,
      });
      result.expired += 1;
      continue;
    }

    const health = deriveWebsubSubscriptionHealth(subscription, now);
    if (health !== subscription.subscription_health) {
      await resolvedDeps.updateHealth({
        id: subscription.id,
        subscriptionHealth: health,
      });
      result.healthUpdated += 1;
    }

    if (subscription.status === "expired") {
      continue;
    }

    const needsResubscribe =
      subscription.status === "renew_failed" ||
      isPendingVerifyStale(
        subscription,
        resolvedDeps.config.pendingVerifyStaleMs,
        now,
      ) ||
      (subscription.status === "active" && health === "degraded");

    if (needsResubscribe) {
      resubscribeTargets.push(subscription);
    }
  }

  if (resubscribeTargets.length > 0) {
    const reconcileResult = createEmptyResult("reconcile");
    await sendSubscribeForSubscriptions(
      resubscribeTargets,
      resolvedDeps,
      reconcileResult,
    );
    result.resubscribed = reconcileResult.attempted;
    result.attempted += reconcileResult.attempted;
    result.succeeded += reconcileResult.succeeded;
    result.failed += reconcileResult.failed;
  }

  return result;
}

export async function markWebsubSubscriptionAsDeadForChannel(input: {
  youtubeChannelId: string;
  reason: string;
  deps?: Partial<WebsubSubscribeManagerDeps>;
}): Promise<boolean> {
  const resolvedDeps = { ...defaultDeps, ...input.deps };
  const subscriptions = await resolvedDeps.listLiveSubscriptions();
  const subscription = subscriptions.find(
    (row) => row.youtube_channel_id === input.youtubeChannelId,
  );

  if (!subscription) {
    return false;
  }

  await resolvedDeps.markDead({
    id: subscription.id,
    reason: input.reason,
    deadAt: resolvedDeps.now(),
  });

  return true;
}
