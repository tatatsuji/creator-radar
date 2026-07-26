import { describe, expect, it } from "vitest";

import {
  applyPromotionHysteresis,
  classifyPromotion,
  computeCandidatePromotionState,
  mapRecommendedMeasurementTier,
} from "@/lib/promotion/classifier";
import { computePromotionMetrics } from "@/lib/promotion/metrics";
import {
  REFERENCE_END_MS,
  decliningSnapshots,
  defaultGenreBaseline,
  makeSnapshot,
  risingBreakoutSnapshots,
  smallSampleGenreBaseline,
  trendingGenreBaseline,
  viralSnapshots,
} from "@/lib/promotion/fixtures";

function buildMetrics(
  snapshots: ReturnType<typeof makeSnapshot>[],
  currentViewCount: number,
  subscriberCount = 10_000,
  genreBaseline: typeof defaultGenreBaseline | null = null,
) {
  return computePromotionMetrics({
    videoId: snapshots[0]?.video_id ?? "video-test",
    snapshots,
    currentViewCount,
    subscriberCount,
    firstDiscoveredAt: "2026-07-25T00:00:00.000Z",
    genreBaseline,
    referenceEndMs: REFERENCE_END_MS,
  });
}

describe("promotion classifier pure functions", () => {
  it("maps promotion states to recommended measurement tiers", () => {
    expect(mapRecommendedMeasurementTier("HOT")).toBe("hot");
    expect(mapRecommendedMeasurementTier("RISING")).toBe("active");
    expect(mapRecommendedMeasurementTier("TRENDING")).toBe("active");
    expect(mapRecommendedMeasurementTier("STABLE")).toBe("normal");
    expect(mapRecommendedMeasurementTier("DECLINING")).toBe("cold");
  });

  it("returns STABLE when velocity is unavailable", () => {
    const candidate = computeCandidatePromotionState(
      buildMetrics(
        [makeSnapshot("video-single", "2026-07-26T06:00:00.000Z", 100)],
        100,
      ),
      100,
      defaultGenreBaseline,
    );

    expect(candidate.state).toBe("STABLE");
    expect(candidate.tags).toContain("insufficient_velocity");
  });

  it("detects RISING for an accelerating breakout series", () => {
    const candidate = computeCandidatePromotionState(
      buildMetrics(risingBreakoutSnapshots, 340, 10_000, null),
      340,
      null,
    );

    expect(candidate.state).toBe("RISING");
    expect(candidate.reason).toBe("velocity_threshold");
    expect(candidate.tags).toContain("acceleration");
  });

  it("detects HOT when 1h velocity exceeds genre p90 on a small video", () => {
    const hotSnapshots = [
      makeSnapshot("video-hot", "2026-07-25T00:00:00.000Z", 100),
      makeSnapshot("video-hot", "2026-07-25T06:00:00.000Z", 130),
      makeSnapshot("video-hot", "2026-07-25T12:00:00.000Z", 160),
      makeSnapshot("video-hot", "2026-07-26T05:00:00.000Z", 220),
      makeSnapshot("video-hot", "2026-07-26T06:00:00.000Z", 320),
    ];
    const metrics = buildMetrics(hotSnapshots, 320);

    const candidate = computeCandidatePromotionState(
      metrics,
      320,
      defaultGenreBaseline,
    );

    expect(candidate.state).toBe("HOT");
    expect(candidate.tags).toContain("above_genre_p90");
  });

  it("does not classify HOT when genre baseline sample count is too small", () => {
    const hotSnapshots = [
      makeSnapshot("video-hot", "2026-07-25T00:00:00.000Z", 100),
      makeSnapshot("video-hot", "2026-07-26T05:00:00.000Z", 220),
      makeSnapshot("video-hot", "2026-07-26T06:00:00.000Z", 320),
    ];
    const metrics = buildMetrics(hotSnapshots, 320);

    const candidate = computeCandidatePromotionState(metrics, 320, smallSampleGenreBaseline);

    expect(candidate.state).not.toBe("HOT");
  });

  it("detects DECLINING when recent velocity collapses", () => {
    const candidate = computeCandidatePromotionState(
      buildMetrics(decliningSnapshots, 1_070),
      1_070,
      defaultGenreBaseline,
    );

    expect(candidate.state).toBe("DECLINING");
    expect(candidate.tags).toContain("deceleration");
  });

  it("detects TRENDING when 24h velocity exceeds genre median", () => {
    const trendingSnapshots = [
      makeSnapshot("video-trending", "2026-07-25T06:00:00.000Z", 100),
      makeSnapshot("video-trending", "2026-07-25T12:00:00.000Z", 400),
      makeSnapshot("video-trending", "2026-07-25T18:00:00.000Z", 700),
      makeSnapshot("video-trending", "2026-07-26T00:00:00.000Z", 1_000),
      makeSnapshot("video-trending", "2026-07-26T05:00:00.000Z", 1_240),
      makeSnapshot("video-trending", "2026-07-26T06:00:00.000Z", 1_300),
    ];
    const metrics = computePromotionMetrics({
      videoId: "video-trending",
      snapshots: trendingSnapshots,
      currentViewCount: 1_300,
      subscriberCount: 10_000,
      firstDiscoveredAt: "2026-07-24T00:00:00.000Z",
      genreBaseline: defaultGenreBaseline,
      referenceEndMs: REFERENCE_END_MS,
    });

    const candidate = computeCandidatePromotionState(
      metrics,
      1_300,
      trendingGenreBaseline,
    );

    expect(candidate.state).toBe("TRENDING");
  });

  it("keeps STABLE for a large viral video without recent acceleration", () => {
    const candidate = computeCandidatePromotionState(
      buildMetrics(viralSnapshots, 5_054_100, 1_000_000, null),
      5_054_100,
      null,
    );

    expect(candidate.state).toBe("STABLE");
  });

  it("applies hysteresis before switching to HOT", () => {
    const hysteresis = applyPromotionHysteresis(
      { state: "HOT", reason: "velocity_threshold", tags: ["above_genre_p90"] },
      "STABLE",
      0,
    );

    expect(hysteresis.promotionState).toBe("STABLE");
    expect(hysteresis.consecutiveRuns).toBe(1);
  });

  it("allows HOT after hysteresis threshold is reached", () => {
    const hysteresis = applyPromotionHysteresis(
      { state: "HOT", reason: "velocity_threshold", tags: ["above_genre_p90"] },
      "STABLE",
      1,
    );

    expect(hysteresis.promotionState).toBe("HOT");
  });

  it("immediately switches to RISING without hysteresis delay", () => {
    const hysteresis = applyPromotionHysteresis(
      { state: "RISING", reason: "velocity_threshold", tags: ["acceleration"] },
      "STABLE",
      0,
    );

    expect(hysteresis.promotionState).toBe("RISING");
    expect(hysteresis.consecutiveRuns).toBe(1);
  });

  it("requires two runs before switching to DECLINING", () => {
    const first = applyPromotionHysteresis(
      { state: "DECLINING", reason: "velocity_threshold", tags: ["deceleration"] },
      "RISING",
      0,
    );
    const second = applyPromotionHysteresis(
      { state: "DECLINING", reason: "velocity_threshold", tags: ["deceleration"] },
      "RISING",
      1,
    );

    expect(first.promotionState).toBe("RISING");
    expect(second.promotionState).toBe("DECLINING");
  });

  it("returns shadow tier sync mode by default", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(risingBreakoutSnapshots, 340, 10_000, null),
      previousState: "STABLE",
      consecutiveRuns: 0,
      currentMeasurementTier: "hot",
      currentViewCount: 340,
      genreBaseline: null,
    });

    expect(result.tierSyncMode).toBe("shadow");
    expect(result.recommendedMeasurementTier).toBe("active");
  });

  it("computes recommended tier independently of the current measurement tier", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(risingBreakoutSnapshots, 340, 10_000, null),
      previousState: "STABLE",
      consecutiveRuns: 0,
      currentMeasurementTier: "hot",
      currentViewCount: 340,
      genreBaseline: null,
    });

    expect(result.recommendedMeasurementTier).toBe("active");
    expect(result.tierSyncMode).toBe("shadow");
  });

  it("preserves previous state in classification output", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(risingBreakoutSnapshots, 340, 10_000, null),
      previousState: "STABLE",
      consecutiveRuns: 1,
      currentMeasurementTier: "hot",
      currentViewCount: 340,
      genreBaseline: null,
    });

    expect(result.previousState).toBe("STABLE");
    expect(result.promotionState).toBe("RISING");
  });

  it("exposes candidate state separately from hysteresis-adjusted state", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(
        [
          makeSnapshot("video-hot", "2026-07-25T00:00:00.000Z", 100),
          makeSnapshot("video-hot", "2026-07-26T05:00:00.000Z", 220),
          makeSnapshot("video-hot", "2026-07-26T06:00:00.000Z", 320),
        ],
        320,
      ),
      previousState: "STABLE",
      consecutiveRuns: 0,
      currentMeasurementTier: "hot",
      currentViewCount: 320,
      genreBaseline: defaultGenreBaseline,
    });

    expect(result.candidateState).toBe("HOT");
    expect(result.promotionState).toBe("STABLE");
  });

  it("increments consecutive runs when candidate matches previous state", () => {
    const metrics = buildMetrics(risingBreakoutSnapshots, 340, 10_000, null);
    const candidate = computeCandidatePromotionState(metrics, 340, null);

    const hysteresis = applyPromotionHysteresis(candidate, "RISING", 2);

    expect(hysteresis.promotionState).toBe("RISING");
    expect(hysteresis.consecutiveRuns).toBe(3);
  });

  it("classifies a first observation without previous state", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(risingBreakoutSnapshots, 340, 10_000, null),
      previousState: null,
      consecutiveRuns: 0,
      currentMeasurementTier: "hot",
      currentViewCount: 340,
      genreBaseline: null,
    });

    expect(result.promotionState).toBe("RISING");
    expect(result.consecutiveRuns).toBe(1);
  });

  it("keeps promotion reason null for stable baseline classification", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(viralSnapshots, 5_054_100, 1_000_000, null),
      previousState: null,
      consecutiveRuns: 0,
      currentMeasurementTier: "normal",
      currentViewCount: 5_054_100,
      genreBaseline: null,
    });

    expect(result.promotionState).toBe("STABLE");
    expect(result.promotionReason).toBeNull();
  });

  it("recommends cold tier for declining classification", () => {
    const result = classifyPromotion({
      metrics: buildMetrics(decliningSnapshots, 1_070),
      previousState: "RISING",
      consecutiveRuns: 1,
      currentMeasurementTier: "active",
      currentViewCount: 1_070,
      genreBaseline: defaultGenreBaseline,
    });

    expect(result.promotionState).toBe("DECLINING");
    expect(result.recommendedMeasurementTier).toBe("cold");
  });
});
