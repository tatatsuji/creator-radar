import { describe, expect, it } from "vitest";

import {
  ADAPTIVE_MEASUREMENT_CONFIG,
  estimateDailyMeasurementCalls,
  getAdaptiveMeasurementIntervalMs,
  normalizeAdaptiveMeasurementTier,
} from "@/lib/measurement/adaptiveMeasurementConfig";
import {
  aggregateAdaptiveMeasurementQuota,
  estimateAdaptiveMeasurementQuota,
} from "@/lib/measurement/adaptiveMeasurementQuota";
import {
  evaluateAdaptiveMeasurementTier,
  evaluateInitialAdaptiveMeasurementTier,
  type AdaptiveMeasurementSignals,
} from "@/lib/measurement/adaptiveMeasurementTierEvaluation";
import {
  buildAdaptiveMeasurementSignals,
  computeStaleWindowMetrics,
} from "@/lib/measurement/adaptiveMeasurementSignals";

function baseSignals(
  overrides: Partial<AdaptiveMeasurementSignals>,
): AdaptiveMeasurementSignals {
  return {
    hoursSincePublish: null,
    v1h: null,
    velocityChangeRate: null,
    viewsGainedSinceLastMeasure: null,
    hoursSinceLastMeasure: null,
    viewsGainedInStaleWindow: null,
    staleWindowHours: null,
    watchlistTier: null,
    hasRankingDiscovery: false,
    snapshotCount: 0,
    ...overrides,
  };
}

describe("evaluateInitialAdaptiveMeasurementTier", () => {
  it("assigns critical to freshly published videos", () => {
    expect(evaluateInitialAdaptiveMeasurementTier(2).tier).toBe("critical");
  });

  it("assigns normal to older published videos", () => {
    expect(evaluateInitialAdaptiveMeasurementTier(24).tier).toBe("normal");
  });

  it("boosts ranking discovery videos to high before first measurement", () => {
    expect(
      evaluateInitialAdaptiveMeasurementTier({
        hoursSincePublish: 24,
        hasRankingDiscovery: true,
      }).tier,
    ).toBe("high");
  });

  it("boosts watchlist hot channels to high before first measurement", () => {
    expect(
      evaluateInitialAdaptiveMeasurementTier({
        hoursSincePublish: 24,
        watchlistTier: "hot",
      }).tier,
    ).toBe("high");
  });

  it("boosts watchlist active channels to normal before first measurement", () => {
    expect(
      evaluateInitialAdaptiveMeasurementTier({
        hoursSincePublish: 24,
        watchlistTier: "active",
      }).tier,
    ).toBe("normal");
  });
});

describe("evaluateAdaptiveMeasurementTier", () => {
  it("assigns critical immediately after publish", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 1,
        v1h: 10,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 100,
        hoursSinceLastMeasure: 1,
        snapshotCount: 2,
      }),
    );

    expect(decision.tier).toBe("critical");
  });

  it("assigns high to rising videos", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 24,
        v1h: 200,
        velocityChangeRate: 0.8,
        viewsGainedSinceLastMeasure: 500,
        hoursSinceLastMeasure: 1,
        snapshotCount: 4,
      }),
    );

    expect(decision.tier).toBe("high");
  });

  it("assigns normal to steady videos", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 48,
        v1h: 40,
        velocityChangeRate: 0.1,
        viewsGainedSinceLastMeasure: 40,
        hoursSinceLastMeasure: 1,
        snapshotCount: 5,
      }),
    );

    expect(decision.tier).toBe("normal");
  });

  it("assigns low to slow videos", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 72,
        v1h: 2,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 2,
        hoursSinceLastMeasure: 6,
        snapshotCount: 6,
      }),
    );

    expect(decision.tier).toBe("low");
  });

  it("assigns archive to long-term stagnant videos", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 240,
        v1h: 0,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 0,
        hoursSinceLastMeasure: 6,
        viewsGainedInStaleWindow: 0,
        staleWindowHours: 30,
        snapshotCount: 8,
      }),
    );

    expect(decision.tier).toBe("archive");
  });

  it("reaches archive during steady low-tier cadence when stale window is flat", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 240,
        v1h: 2,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 0,
        hoursSinceLastMeasure: 6,
        viewsGainedInStaleWindow: 0,
        staleWindowHours: 24,
        snapshotCount: 5,
      }),
    );

    expect(decision.tier).toBe("archive");
  });

  it("does not archive when stale window is shorter than configured stale hours", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 240,
        v1h: 2,
        viewsGainedInStaleWindow: 0,
        staleWindowHours: 12,
        snapshotCount: 3,
      }),
    );

    expect(decision.tier).toBe("low");
  });

  it("respects overridden rising thresholds", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 24,
        v1h: 20,
        velocityChangeRate: 0.2,
        viewsGainedSinceLastMeasure: 20,
        hoursSinceLastMeasure: 1,
        snapshotCount: 3,
      }),
      {
        ...ADAPTIVE_MEASUREMENT_CONFIG,
        risingMinViewsPerHour: 10,
        risingVelocityChangeRate: 0.1,
      },
    );

    expect(decision.tier).toBe("high");
  });
});

describe("computeStaleWindowMetrics", () => {
  it("measures growth across the configured stale window", () => {
    const measuredAtMs = Date.parse("2026-07-24T12:00:00.000Z");
    const metrics = computeStaleWindowMetrics({
      snapshots: [
        {
          id: "1",
          video_id: "video-1",
          view_count: 100,
          like_count: 0,
          comment_count: 0,
          subscriber_count: null,
          captured_at: "2026-07-23T11:00:00.000Z",
        },
        {
          id: "2",
          video_id: "video-1",
          view_count: 100,
          like_count: 0,
          comment_count: 0,
          subscriber_count: null,
          captured_at: "2026-07-24T11:00:00.000Z",
        },
      ],
      currentViewCount: 100,
      measuredAtMs,
    });

    expect(metrics.viewsGainedInStaleWindow).toBe(0);
    expect(metrics.staleWindowHours).toBeGreaterThanOrEqual(24);
  });
});

describe("adaptive measurement quota", () => {
  it("estimates fewer daily calls for slower tiers", () => {
    const high = estimateAdaptiveMeasurementQuota("hot", "high");
    const archive = estimateAdaptiveMeasurementQuota("hot", "archive");

    expect(archive.savedDailyCalls).toBeGreaterThan(high.savedDailyCalls);
  });

  it("aggregates quota savings across videos", () => {
    const aggregate = aggregateAdaptiveMeasurementQuota([
      estimateAdaptiveMeasurementQuota("hot", "archive"),
      estimateAdaptiveMeasurementQuota("hot", "low"),
    ]);

    expect(aggregate.savedDailyCalls).toBeGreaterThan(0);
  });

  it("uses configured adaptive intervals", () => {
    expect(getAdaptiveMeasurementIntervalMs("critical")).toBe(
      ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.critical,
    );
    expect(estimateDailyMeasurementCalls(getAdaptiveMeasurementIntervalMs("archive"))).toBe(1);
  });

  it("normalizes legacy measurement tiers", () => {
    expect(normalizeAdaptiveMeasurementTier("hot")).toBe("high");
    expect(normalizeAdaptiveMeasurementTier("cold")).toBe("low");
  });
});

describe("buildAdaptiveMeasurementSignals integration shape", () => {
  it("derives velocity metrics from snapshots", () => {
    const now = Date.parse("2026-07-24T12:00:00.000Z");
    const signals = buildAdaptiveMeasurementSignals({
      publishedAt: "2026-07-24T06:00:00.000Z",
      lastMeasuredAt: "2026-07-24T11:00:00.000Z",
      currentViewCount: 1000,
      snapshots: [
        {
          id: "1",
          video_id: "video-1",
          view_count: 800,
          like_count: 10,
          comment_count: 1,
          subscriber_count: null,
          captured_at: "2026-07-24T11:00:00.000Z",
        },
        {
          id: "2",
          video_id: "video-1",
          view_count: 1000,
          like_count: 12,
          comment_count: 2,
          subscriber_count: null,
          captured_at: "2026-07-24T12:00:00.000Z",
        },
      ],
      watchlistTier: "hot",
      hasRankingDiscovery: true,
      measuredAtMs: now,
    });

    expect(signals.v1h).not.toBeNull();
    expect(signals.hoursSincePublish).toBe(6);
  });

  it("promotes watchlist hot channels to at least high", () => {
    const decision = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: 48,
        v1h: 2,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 2,
        hoursSinceLastMeasure: 6,
        watchlistTier: "hot",
        snapshotCount: 6,
      }),
    );

    expect(decision.tier).toBe("high");
  });

  it("uses fresh publish boundary at exactly freshPublishHours", () => {
    const atBoundary = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: ADAPTIVE_MEASUREMENT_CONFIG.freshPublishHours,
        v1h: 1,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 1,
        hoursSinceLastMeasure: 1,
        snapshotCount: 1,
      }),
    );
    const justOver = evaluateAdaptiveMeasurementTier(
      baseSignals({
        hoursSincePublish: ADAPTIVE_MEASUREMENT_CONFIG.freshPublishHours + 0.1,
        v1h: 1,
        velocityChangeRate: 0,
        viewsGainedSinceLastMeasure: 1,
        hoursSinceLastMeasure: 1,
        snapshotCount: 1,
      }),
    );

    expect(atBoundary.tier).toBe("critical");
    expect(justOver.tier).toBe("low");
  });
});
