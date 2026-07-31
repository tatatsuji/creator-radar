import { describe, expect, it } from "vitest";

import {
  AUTO_PROMOTION_TIER_THRESHOLDS,
  AUTO_WATCHLIST_CONFIG,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistConfig";
import {
  aggregateChannelDiscoveryMetrics,
  createEmptyChannelMetrics,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistMetrics";
import {
  evaluateAutoWatchlistTierChange,
  evaluateWatchlistDemotion,
  evaluateWatchlistPromotion,
  evaluateWatchlistRestore,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistTierEvaluation";
import type { DiscoverySourceType } from "@/types/observability";

function makeDiscovery(
  sourceType: DiscoverySourceType,
  overrides: Partial<{
    videoId: string;
    metadata: Record<string, unknown> | null;
  }> = {},
) {
  return {
    channelId: "UC1234567890abcdefghij",
    sourceType,
    videoId: overrides.videoId ?? "video1234567",
    discoveredAt: "2026-07-24T00:00:00.000Z",
    metadata: overrides.metadata ?? null,
  };
}

describe("autoWatchlist metrics aggregation", () => {
  it("counts performance and ranking discoveries separately", () => {
    const metrics = aggregateChannelDiscoveryMetrics(
      "UC1234567890abcdefghij",
      [
        makeDiscovery("search"),
        makeDiscovery("watchlist_upload", { videoId: "video2" }),
        makeDiscovery("category_search", { videoId: "video3" }),
      ],
      "2026-07-20T00:00:00.000Z",
    );

    expect(metrics.performanceDiscoveryCount).toBe(2);
    expect(metrics.rankingDiscoveryCount).toBe(2);
    expect(metrics.distinctPerformanceVideoCount).toBe(2);
  });

  it("detects rising discoveries from metadata", () => {
    const metrics = aggregateChannelDiscoveryMetrics(
      "UC1234567890abcdefghij",
      [
        makeDiscovery("search", {
          metadata: { hotCandidate: true },
        }),
      ],
      null,
    );

    expect(metrics.risingDiscoveryCount).toBe(1);
  });
});

describe("evaluateWatchlistPromotion", () => {
  it("promotes cold to normal when discovery threshold is met", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.performanceDiscoveryCount =
      AUTO_PROMOTION_TIER_THRESHOLDS.cold.minDiscoveryCount;

    const decision = evaluateWatchlistPromotion("cold", metrics);
    expect(decision).toEqual({
      action: "PROMOTE",
      nextTier: "normal",
      reason: expect.stringContaining("performanceDiscoveryCount="),
    });
  });

  it("promotes active to hot when ranking threshold is met", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.rankingDiscoveryCount =
      AUTO_PROMOTION_TIER_THRESHOLDS.active.minRankingDiscoveryCount;

    const decision = evaluateWatchlistPromotion("active", metrics);
    expect(decision?.nextTier).toBe("hot");
  });

  it("does not promote hot channels", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.performanceDiscoveryCount = 100;
    expect(evaluateWatchlistPromotion("hot", metrics)).toBeNull();
  });

  it("respects overridden promotion thresholds", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.performanceDiscoveryCount = 1;

    const decision = evaluateWatchlistPromotion("cold", metrics, {
      ...AUTO_WATCHLIST_CONFIG,
      promotionTierThresholds: {
        ...AUTO_PROMOTION_TIER_THRESHOLDS,
        cold: {
          minDiscoveryCount: 1,
          minRankingDiscoveryCount: 99,
          minRisingDiscoveryCount: 99,
        },
      },
    });

    expect(decision?.nextTier).toBe("normal");
  });
});

describe("evaluateWatchlistDemotion", () => {
  const nowMs = Date.parse("2026-07-31T00:00:00.000Z");

  it("demotes one tier when upload, discovery, and ranking are all inactive", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.lastUploadAt = "2026-06-01T00:00:00.000Z";

    const decision = evaluateWatchlistDemotion("hot", metrics, nowMs);
    expect(decision).toEqual({
      action: "DEMOTE",
      nextTier: "active",
      reason: expect.stringContaining("uploadInactive=true"),
    });
  });

  it("does not demote when recent discoveries exist", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.lastUploadAt = "2026-06-01T00:00:00.000Z";
    metrics.performanceDiscoveryCount = 1;

    expect(evaluateWatchlistDemotion("normal", metrics, nowMs)).toBeNull();
  });

  it("steps down to archive from cold rather than skipping tiers", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.lastUploadAt = null;

    const decision = evaluateWatchlistDemotion("cold", metrics, nowMs);
    expect(decision?.nextTier).toBe("archive");
  });
});

describe("evaluateWatchlistRestore", () => {
  const nowMs = Date.parse("2026-07-31T00:00:00.000Z");

  it("restores archive channels to cold on ranking discovery", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.rankingDiscoveryCount = AUTO_WATCHLIST_CONFIG.restoreMinRankingDiscoveryCount;

    const decision = evaluateWatchlistRestore("archive", metrics, nowMs);
    expect(decision).toEqual({
      action: "RESTORE",
      nextTier: "cold",
      reason: expect.stringContaining("rankingDiscoveryCount="),
    });
  });

  it("restores archive channels on recent uploads", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.lastUploadAt = "2026-07-30T00:00:00.000Z";

    const decision = evaluateWatchlistRestore("archive", metrics, nowMs);
    expect(decision?.nextTier).toBe("cold");
  });

  it("does not restore archive channels without activity signals", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    expect(evaluateWatchlistRestore("archive", metrics, nowMs)).toBeNull();
  });
});

describe("evaluateAutoWatchlistTierChange", () => {
  it("prioritizes restore over demotion for archive channels", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.performanceDiscoveryCount = 1;

    expect(evaluateAutoWatchlistTierChange("archive", metrics)?.action).toBe(
      "RESTORE",
    );
  });

  it("prioritizes promotion over demotion for active tiers", () => {
    const metrics = createEmptyChannelMetrics("UC1234567890abcdefghij");
    metrics.performanceDiscoveryCount =
      AUTO_PROMOTION_TIER_THRESHOLDS.cold.minDiscoveryCount;
    metrics.lastUploadAt = "2026-06-01T00:00:00.000Z";

    expect(evaluateAutoWatchlistTierChange("cold", metrics)?.action).toBe(
      "PROMOTE",
    );
  });
});
