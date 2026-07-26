import { describe, expect, it } from "vitest";

import { classifyPromotion } from "@/lib/promotion/classifier";
import { computePromotionMetrics } from "@/lib/promotion/metrics";
import {
  REFERENCE_END_MS,
  decliningSnapshots,
  defaultGenreBaseline,
  makeSnapshot,
  risingBreakoutSnapshots,
  viralSnapshots,
} from "@/lib/promotion/fixtures";
import {
  computeAccelerationBoost,
  computeEarlyDiscoveryBoost,
  computeRadarScoreV2,
  computeRadarScoreV2Raw,
} from "@/lib/ranking/scoreV2";

describe("radar score v2 pure functions", () => {
  const risingMetrics = computePromotionMetrics({
    videoId: "video-rising",
    snapshots: risingBreakoutSnapshots,
    currentViewCount: 340,
    subscriberCount: 10_000,
    firstDiscoveredAt: "2026-07-25T00:00:00.000Z",
    genreBaseline: defaultGenreBaseline,
    referenceEndMs: REFERENCE_END_MS,
  });

  const viralMetrics = computePromotionMetrics({
    videoId: "video-viral",
    snapshots: viralSnapshots,
    currentViewCount: 5_054_100,
    subscriberCount: 1_000_000,
    firstDiscoveredAt: "2026-07-20T00:00:00.000Z",
    referenceEndMs: REFERENCE_END_MS,
  });

  it("returns null when snapshot quality is unavailable", () => {
    const metrics = computePromotionMetrics({
      videoId: "video-single",
      snapshots: [makeSnapshot("video-single", "2026-07-26T06:00:00.000Z", 100)],
      currentViewCount: 100,
      subscriberCount: 1_000,
      firstDiscoveredAt: "2026-07-26T00:00:00.000Z",
      referenceEndMs: REFERENCE_END_MS,
    });

    expect(
      computeRadarScoreV2({
        metrics,
        promotionState: "STABLE",
        currentViewCount: 100,
      }),
    ).toBeNull();
  });

  it("boosts early discovery within the configured window", () => {
    expect(computeEarlyDiscoveryBoost(24)).toBeGreaterThan(
      computeEarlyDiscoveryBoost(100),
    );
    expect(computeEarlyDiscoveryBoost(null)).toBe(0);
  });

  it("boosts score when acceleration is positive", () => {
    expect(computeAccelerationBoost(1.5)).toBeGreaterThan(1);
    expect(computeAccelerationBoost(0)).toBe(1);
    expect(computeAccelerationBoost(null)).toBe(1);
  });

  it("scores a rising breakout higher than a flat viral video", () => {
    const risingScore = computeRadarScoreV2({
      metrics: risingMetrics,
      promotionState: "RISING",
      currentViewCount: 340,
    });
    const viralScore = computeRadarScoreV2({
      metrics: viralMetrics,
      promotionState: "STABLE",
      currentViewCount: 5_054_100,
    });

    expect(risingScore).not.toBeNull();
    expect(viralScore).not.toBeNull();
    expect(risingScore!).toBeGreaterThan(viralScore!);
  });

  it("applies a declining multiplier to reduce score", () => {
    const decliningMetrics = computePromotionMetrics({
      videoId: "video-declining",
      snapshots: decliningSnapshots,
      currentViewCount: 1_070,
      subscriberCount: 5_000,
      firstDiscoveredAt: "2026-07-25T00:00:00.000Z",
      referenceEndMs: REFERENCE_END_MS,
    });

    if (decliningMetrics.snapshotQuality === "unavailable") {
      return;
    }

    const stableRaw = computeRadarScoreV2Raw({
      metrics: decliningMetrics,
      promotionState: "STABLE",
      currentViewCount: 1_070,
    });
    const decliningRaw = computeRadarScoreV2Raw({
      metrics: decliningMetrics,
      promotionState: "DECLINING",
      currentViewCount: 1_070,
    });

    expect(decliningRaw).toBeLessThan(stableRaw);
  });

  it("applies a rising multiplier for active growth states", () => {
    const stableRaw = computeRadarScoreV2Raw({
      metrics: risingMetrics,
      promotionState: "STABLE",
      currentViewCount: 340,
    });
    const risingRaw = computeRadarScoreV2Raw({
      metrics: risingMetrics,
      promotionState: "RISING",
      currentViewCount: 340,
    });

    expect(risingRaw).toBeGreaterThan(stableRaw);
  });

  it("caps normalized score at 100", () => {
    const extremeMetrics = {
      ...risingMetrics,
      v1h: 100_000,
      acceleration: 5,
      viewsPerSubscriber1h: 30,
      genreZScore: 10,
      discoveryAgeHours: 1,
      absoluteSizePenalty: 1,
      snapshotQuality: "measured" as const,
    };

    expect(
      computeRadarScoreV2({
        metrics: extremeMetrics,
        promotionState: "HOT",
        currentViewCount: 500,
      }),
    ).toBe(100);
  });

  it("returns a lower score for estimated snapshot quality", () => {
    const estimatedMetrics = {
      ...risingMetrics,
      snapshotQuality: "estimated" as const,
    };

    const measuredScore = computeRadarScoreV2({
      metrics: risingMetrics,
      promotionState: "RISING",
      currentViewCount: 340,
    });
    const estimatedScore = computeRadarScoreV2({
      metrics: estimatedMetrics,
      promotionState: "RISING",
      currentViewCount: 340,
    });

    expect(measuredScore).not.toBeNull();
    expect(estimatedScore).not.toBeNull();
    expect(estimatedScore!).toBeLessThan(measuredScore!);
  });

  it("integrates promotion classification with score generation", () => {
    const classification = classifyPromotion({
      metrics: risingMetrics,
      previousState: "STABLE",
      consecutiveRuns: 0,
      currentMeasurementTier: "hot",
      currentViewCount: 340,
      genreBaseline: null,
    });

    const score = computeRadarScoreV2({
      metrics: risingMetrics,
      promotionState: classification.promotionState,
      currentViewCount: 340,
    });

    expect(classification.promotionState).toBe("RISING");
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0);
  });

  it("keeps normalized score within 0-100", () => {
    const score = computeRadarScoreV2({
      metrics: risingMetrics,
      promotionState: "RISING",
      currentViewCount: 340,
    });

    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(100);
  });
});
