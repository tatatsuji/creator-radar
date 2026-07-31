import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadWebsubObservabilityStatus } from "@/lib/observability/websubStatus";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => true),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/discovery/runsRepository", () => ({
  getLatestDiscoveryRun: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestDiscoveryRun } from "@/lib/discovery/runsRepository";

function createQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "in", "gte", "eq", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(finalResult).then(onFulfilled);
  return builder;
}

describe("loadWebsubObservabilityStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates subscription, notification, and watchlist fallback metrics", async () => {
    const subscriptionsBuilder = createQueryBuilder({
      data: [
        {
          status: "active",
          subscription_health: "healthy",
          last_subscribe_at: "2026-07-31T10:00:00.000Z",
          last_verified_at: "2026-07-31T11:00:00.000Z",
          subscribe_attempt_count: 1,
        },
        {
          status: "renew_failed",
          subscription_health: "degraded",
          last_subscribe_at: "2026-07-31T09:00:00.000Z",
          last_verified_at: null,
          subscribe_attempt_count: 3,
        },
        {
          status: "pending_verify",
          subscription_health: "unhealthy",
          last_subscribe_at: "2026-07-31T08:00:00.000Z",
          last_verified_at: null,
          subscribe_attempt_count: 1,
        },
      ],
      error: null,
    });

    const backlogBuilder = createQueryBuilder({
      data: [
        { status: "pending", quota_units_used: 0 },
        { status: "processing", quota_units_used: 0 },
      ],
      error: null,
    });

    const notifications24hBuilder = createQueryBuilder({
      data: [
        { status: "processed", quota_units_used: 1, updated_at: "2026-07-31T12:00:00.000Z" },
        { status: "failed", quota_units_used: 0, updated_at: "2026-07-31T12:00:00.000Z" },
        { status: "skipped_known", quota_units_used: 0, updated_at: "2026-07-31T12:00:00.000Z" },
      ],
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(subscriptionsBuilder)
        .mockReturnValueOnce(backlogBuilder)
        .mockReturnValueOnce(notifications24hBuilder),
    } as never);

    vi.mocked(getLatestDiscoveryRun).mockResolvedValue({
      id: "run-1",
      run_type: "watchlist_check",
      finished_at: "2026-07-31T12:00:00.000Z",
      metadata: {
        channelsSkippedWebsubHealthy: 4,
        channelsSafetyPoll: 2,
        channelsNormalPoll: 1,
      },
    } as never);

    const status = await loadWebsubObservabilityStatus();

    expect(status.environment.enabled).toBe(false);
    expect(status.subscriptions.total).toBe(3);
    expect(status.subscriptions.byHealth.healthy).toBe(1);
    expect(status.notifications.backlogPending).toBe(1);
    expect(status.notifications.backlogProcessing).toBe(1);
    expect(status.notifications.last24Hours.processed).toBe(1);
    expect(status.notifications.last24Hours.failed).toBe(1);
    expect(status.notifications.last24Hours.skippedKnown).toBe(1);
    expect(status.notifications.last24Hours.quotaUnitsUsed).toBe(1);
    expect(status.watchlistPollFallback.lastRun).toEqual({
      channelsSkippedHealthy: 4,
      channelsSafetyPoll: 2,
      channelsNormalPoll: 1,
      collectedAt: "2026-07-31T12:00:00.000Z",
    });
    expect(status.subscribeOperations.last24Hours.successCount).toBe(2);
    expect(status.subscribeOperations.last24Hours.failureCount).toBe(1);
  });
});
