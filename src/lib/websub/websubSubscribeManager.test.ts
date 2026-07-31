import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  markWebsubSubscriptionAsDeadForChannel,
  runWebsubReconcile,
  runWebsubRenewDaily,
  runWebsubRenewUrgent,
  runWebsubSubscribeNew,
  type WebsubSubscribeManagerDeps,
} from "@/lib/websub/websubSubscribeManager";
import type { WebsubSubscriptionRecord } from "@/lib/websub/websubSubscriptionRepository";

const CHANNEL_ID = "UC1234567890abcdefghij";
const NOW = new Date("2026-07-31T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function makeSubscription(
  overrides: Partial<WebsubSubscriptionRecord> = {},
): WebsubSubscriptionRecord {
  return {
    id: overrides.id ?? "sub-1",
    youtube_channel_id: overrides.youtube_channel_id ?? CHANNEL_ID,
    topic_url:
      overrides.topic_url ??
      `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
    hub_url: "https://pubsubhubbub.appspot.com/subscribe",
    callback_url: "https://example.com/api/websub/callback",
    status: overrides.status ?? "pending",
    subscription_health: overrides.subscription_health ?? "unhealthy",
    lease_expires_at: overrides.lease_expires_at ?? null,
    secret_version: 1,
    subscribe_attempt_count: overrides.subscribe_attempt_count ?? 0,
    last_subscribe_at: overrides.last_subscribe_at ?? null,
    last_verified_at: overrides.last_verified_at ?? null,
    last_notification_at: null,
    last_error: overrides.last_error ?? null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function createDeps(
  overrides: Partial<WebsubSubscribeManagerDeps> = {},
): WebsubSubscribeManagerDeps {
  return {
    isEnabled: vi.fn(() => true),
    isSupabaseReady: vi.fn(() => true),
    listWatchlistChannelIds: vi.fn(async () => [CHANNEL_ID]),
    listWatchlistChannels: vi.fn(async () => [
      { channelId: CHANNEL_ID, watchTier: "hot" as const },
    ]),
    listLiveSubscriptions: vi.fn(async () => []),
    listReconcileSubscriptions: vi.fn(async () => []),
    createSubscription: vi.fn(async (youtubeChannelId: string) =>
      makeSubscription({
        id: "created-sub",
        youtube_channel_id: youtubeChannelId,
        status: "pending",
      }),
    ),
    markSubscribeSuccess: vi.fn(async () => undefined),
    markSubscribeFailure: vi.fn(async () => undefined),
    updateHealth: vi.fn(async () => undefined),
    markExpired: vi.fn(async () => undefined),
    markOrphaned: vi.fn(async () => undefined),
    markDead: vi.fn(async () => undefined),
    postHubSubscribe: vi.fn(async () => ({
      ok: true,
      status: 202,
      body: "accepted",
    })),
    getCallbackUrl: vi.fn(() => "https://example.com/api/websub/callback"),
    now: vi.fn(() => NOW),
    config: {
      subscribeBatchLimit: 200,
      subscribeConcurrency: 10,
      leaseRequestSeconds: 604800,
      hubSecret: "secret",
      pendingVerifyStaleMs: 48 * HOUR_MS,
      maxSubscribeAttempts: 5,
      urgentRenewWithinMs: 72 * HOUR_MS,
      dailyRenewWithinMs: 7 * DAY_MS,
      canaryMaxChannels: 0,
    },
    ...overrides,
  };
}

describe("runWebsubSubscribeNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips when WebSub is disabled", async () => {
    const deps = createDeps({ isEnabled: vi.fn(() => false) });
    const result = await runWebsubSubscribeNew(deps);

    expect(result.status).toBe("skipped");
    expect(deps.postHubSubscribe).not.toHaveBeenCalled();
  });

  it("creates and subscribes new watchlist channels", async () => {
    const deps = createDeps({
      listLiveSubscriptions: vi.fn(async () => []),
    });

    const result = await runWebsubSubscribeNew(deps);

    expect(deps.createSubscription).toHaveBeenCalledWith(CHANNEL_ID);
    expect(deps.postHubSubscribe).toHaveBeenCalledTimes(1);
    expect(deps.markSubscribeSuccess).toHaveBeenCalledWith({
      id: "created-sub",
      subscribedAt: NOW,
    });
    expect(result.succeeded).toBe(1);
  });

  it("sets pending_verify on subscribe success without activating", async () => {
    const pending = makeSubscription({ id: "pending-sub", status: "pending" });
    const deps = createDeps({
      listLiveSubscriptions: vi.fn(async () => [pending]),
    });

    await runWebsubSubscribeNew(deps);

    expect(deps.markSubscribeSuccess).toHaveBeenCalledWith({
      id: "pending-sub",
      subscribedAt: NOW,
    });
    expect(deps.markSubscribeFailure).not.toHaveBeenCalled();
  });

  it("marks renew_failed when subscribe POST fails", async () => {
    const pending = makeSubscription({ id: "pending-sub", status: "pending" });
    const deps = createDeps({
      listLiveSubscriptions: vi.fn(async () => [pending]),
      postHubSubscribe: vi.fn(async () => ({
        ok: false,
        status: 500,
        body: "hub error",
      })),
    });

    const result = await runWebsubSubscribeNew(deps);

    expect(deps.markSubscribeFailure).toHaveBeenCalledWith({
      id: "pending-sub",
      errorMessage: "Hub subscribe failed (500): hub error",
      failedAt: NOW,
    });
    expect(result.failed).toBe(1);
  });

  it("applies canary cap to subscribe-new only selecting hot-first channels", async () => {
    const channels = [
      { channelId: "UCcold-2", watchTier: "cold" as const },
      { channelId: "UChot-2", watchTier: "hot" as const },
      { channelId: "UCnormal-1", watchTier: "normal" as const },
      { channelId: "UChot-1", watchTier: "hot" as const },
    ];
    const deps = createDeps({
      listWatchlistChannels: vi.fn(async () => channels),
      listLiveSubscriptions: vi.fn(async () => []),
      config: {
        subscribeBatchLimit: 200,
        subscribeConcurrency: 10,
        leaseRequestSeconds: 604800,
        hubSecret: "secret",
        pendingVerifyStaleMs: 48 * HOUR_MS,
        maxSubscribeAttempts: 5,
        urgentRenewWithinMs: 72 * HOUR_MS,
        dailyRenewWithinMs: 7 * DAY_MS,
        canaryMaxChannels: 2,
      },
    });

    const result = await runWebsubSubscribeNew(deps);

    expect(result.canary).toEqual({
      maxChannels: 2,
      eligibleCount: 4,
      selectedCount: 2,
      skippedByCapCount: 2,
    });
    expect(deps.createSubscription).toHaveBeenCalledTimes(2);
    expect(deps.createSubscription).toHaveBeenCalledWith("UChot-1");
    expect(deps.createSubscription).toHaveBeenCalledWith("UChot-2");
    expect(deps.createSubscription).not.toHaveBeenCalledWith("UCnormal-1");
    expect(deps.createSubscription).not.toHaveBeenCalledWith("UCcold-2");
  });
});

describe("runWebsubRenewUrgent", () => {
  it("renews active subscriptions expiring within 72 hours", async () => {
    const urgent = makeSubscription({
      id: "urgent-sub",
      status: "active",
      lease_expires_at: new Date(NOW.getTime() + 24 * HOUR_MS).toISOString(),
      last_verified_at: NOW.toISOString(),
      subscription_health: "degraded",
    });
    const healthy = makeSubscription({
      id: "healthy-sub",
      status: "active",
      lease_expires_at: new Date(NOW.getTime() + 10 * DAY_MS).toISOString(),
      last_verified_at: NOW.toISOString(),
      subscription_health: "healthy",
    });
    const deps = createDeps({
      listLiveSubscriptions: vi.fn(async () => [urgent, healthy]),
    });

    const result = await runWebsubRenewUrgent(deps);

    expect(deps.postHubSubscribe).toHaveBeenCalledTimes(1);
    expect(deps.markSubscribeSuccess).toHaveBeenCalledWith({
      id: "urgent-sub",
      subscribedAt: NOW,
    });
    expect(result.succeeded).toBe(1);
  });
});

describe("runWebsubRenewDaily", () => {
  it("renews active subscriptions expiring within 7 days", async () => {
    const renewTarget = makeSubscription({
      id: "daily-sub",
      status: "active",
      lease_expires_at: new Date(NOW.getTime() + 5 * DAY_MS).toISOString(),
      last_verified_at: NOW.toISOString(),
    });
    const deps = createDeps({
      listLiveSubscriptions: vi.fn(async () => [renewTarget]),
    });

    const result = await runWebsubRenewDaily(deps);

    expect(result.attempted).toBe(1);
    expect(result.succeeded).toBe(1);
  });
});

describe("runWebsubReconcile", () => {
  it("updates subscription_health transitions", async () => {
    const degraded = makeSubscription({
      id: "degraded-sub",
      status: "active",
      subscription_health: "healthy",
      lease_expires_at: new Date(NOW.getTime() + 24 * HOUR_MS).toISOString(),
      last_verified_at: NOW.toISOString(),
    });
    const deps = createDeps({
      listReconcileSubscriptions: vi.fn(async () => [degraded]),
    });

    const result = await runWebsubReconcile(deps);

    expect(deps.updateHealth).toHaveBeenCalledWith({
      id: "degraded-sub",
      subscriptionHealth: "degraded",
    });
    expect(result.healthUpdated).toBe(1);
    expect(deps.postHubSubscribe).toHaveBeenCalledTimes(1);
    expect(result.resubscribed).toBe(1);
  });

  it("re-subscribes stale pending_verify subscriptions", async () => {
    const stalePendingVerify = makeSubscription({
      id: "stale-verify",
      status: "pending_verify",
      last_subscribe_at: new Date(NOW.getTime() - 49 * HOUR_MS).toISOString(),
    });
    const deps = createDeps({
      listReconcileSubscriptions: vi.fn(async () => [stalePendingVerify]),
    });

    const result = await runWebsubReconcile(deps);

    expect(deps.postHubSubscribe).toHaveBeenCalledTimes(1);
    expect(result.resubscribed).toBe(1);
  });

  it("marks subscriptions expired after max attempts", async () => {
    const exhausted = makeSubscription({
      id: "exhausted-sub",
      status: "renew_failed",
      subscribe_attempt_count: 5,
    });
    const deps = createDeps({
      listReconcileSubscriptions: vi.fn(async () => [exhausted]),
    });

    const result = await runWebsubReconcile(deps);

    expect(deps.markExpired).toHaveBeenCalledWith({
      id: "exhausted-sub",
      expiredAt: NOW,
    });
    expect(result.expired).toBe(1);
    expect(deps.postHubSubscribe).not.toHaveBeenCalled();
  });

  it("marks orphaned subscriptions removed from watchlist", async () => {
    const orphan = makeSubscription({
      id: "orphan-sub",
      youtube_channel_id: "UCremovedchannel0001",
      status: "active",
    });
    const deps = createDeps({
      listWatchlistChannelIds: vi.fn(async () => [CHANNEL_ID]),
      listReconcileSubscriptions: vi.fn(async () => [orphan]),
    });

    const result = await runWebsubReconcile(deps);

    expect(deps.markOrphaned).toHaveBeenCalledWith({
      id: "orphan-sub",
      orphanedAt: NOW,
    });
    expect(result.orphaned).toBe(1);
  });

  it("skips when WebSub is disabled", async () => {
    const deps = createDeps({ isEnabled: vi.fn(() => false) });
    const result = await runWebsubReconcile(deps);
    expect(result.status).toBe("skipped");
  });
});

describe("markWebsubSubscriptionAsDeadForChannel", () => {
  it("marks live subscriptions as dead", async () => {
    const live = makeSubscription({ id: "live-sub", status: "active" });
    const deps = createDeps({
      listLiveSubscriptions: vi.fn(async () => [live]),
    });

    const updated = await markWebsubSubscriptionAsDeadForChannel({
      youtubeChannelId: CHANNEL_ID,
      reason: "channel invalid",
      deps,
    });

    expect(updated).toBe(true);
    expect(deps.markDead).toHaveBeenCalledWith({
      id: "live-sub",
      reason: "channel invalid",
      deadAt: NOW,
    });
  });
});
