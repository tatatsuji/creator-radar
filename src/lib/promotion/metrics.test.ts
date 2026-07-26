import { describe, expect, it } from "vitest";

import {
  computeAcceleration,
  computeAbsoluteSizePenalty,
  computeDiscoveryAgeHours,
  computeGenreZScore,
  computePromotionMetrics,
  computeSelfRollingAverage1h,
  computeSelfZScore,
  computeVelocityChangeAbsolute,
  computeVelocityChangeRate,
  computeViewsPerSubscriber1h,
} from "@/lib/promotion/metrics";
import {
  REFERENCE_END_MS,
  decliningSnapshots,
  defaultGenreBaseline,
  makeSnapshot,
  risingBreakoutSnapshots,
  smallSampleGenreBaseline,
  viralSnapshots,
} from "@/lib/promotion/fixtures";

describe("promotion metrics pure functions", () => {
  it("computes positive acceleration when 1h velocity exceeds prior interval average", () => {
    expect(computeAcceleration(120, 60)).toBe(3);
  });

  it("returns zero acceleration when velocities are flat across windows", () => {
    expect(computeAcceleration(20, 20)).toBe(0);
  });

  it("returns null acceleration when 3h velocity is unavailable", () => {
    expect(computeAcceleration(120, null)).toBeNull();
  });

  it("computes prior interval velocity from 1h and 3h windows", () => {
    expect(computeVelocityChangeAbsolute(120, 60)).toBe(90);
    expect(computeVelocityChangeRate(120, 60)).toBe(3);
  });

  it("computes rolling 1h average from consecutive snapshots", () => {
    const average = computeSelfRollingAverage1h(
      risingBreakoutSnapshots,
      REFERENCE_END_MS,
    );

    expect(average).not.toBeNull();
    expect(average!).toBeGreaterThan(0);
  });

  it("computes self z-score from rolling samples", () => {
    const zScore = computeSelfZScore(120, 30, [10, 20, 30, 40]);

    expect(zScore).toBeGreaterThan(0);
  });

  it("falls back to average-based z-score when only one rolling sample exists", () => {
    const zScore = computeSelfZScore(60, 20, [20]);

    expect(zScore).toBe(2);
  });

  it("returns null genre z-score when baseline sample count is too small", () => {
    expect(computeGenreZScore(80, smallSampleGenreBaseline)).toBeNull();
  });

  it("computes genre z-score when baseline sample count is sufficient", () => {
    expect(computeGenreZScore(80, defaultGenreBaseline)).toBe(3);
  });

  it("computes views per subscriber from 1h velocity", () => {
    expect(computeViewsPerSubscriber1h(120, 1_000)).toBe(0.12);
  });

  it("returns null views per subscriber when subscriber count is hidden", () => {
    expect(computeViewsPerSubscriber1h(120, 1_000, true)).toBeNull();
  });

  it("computes discovery age in hours", () => {
    const ageHours = computeDiscoveryAgeHours(
      "2026-07-25T00:00:00.000Z",
      REFERENCE_END_MS,
    );

    expect(ageHours).toBe(30);
  });

  it("computes absolute size penalty from view count", () => {
    expect(computeAbsoluteSizePenalty(1_000)).toBeCloseTo(3.000434077, 5);
  });

  it("builds promotion metrics for a rising breakout snapshot series", () => {
    const metrics = computePromotionMetrics({
      videoId: "video-rising",
      snapshots: risingBreakoutSnapshots,
      currentViewCount: 340,
      subscriberCount: 10_000,
      firstDiscoveredAt: "2026-07-25T00:00:00.000Z",
      genreBaseline: defaultGenreBaseline,
      referenceEndMs: REFERENCE_END_MS,
    });

    expect(metrics.snapshotQuality).not.toBe("unavailable");
    expect(metrics.v1h).toBeGreaterThan(metrics.selfRollingAvg1h ?? 0);
    expect(
      (metrics.acceleration ?? 0) > 0 || (metrics.accelerationPerHour ?? 0) > 0,
    ).toBe(true);
    expect(metrics.discoveryAgeHours).toBe(30);
  });

  it("marks unavailable quality when only one snapshot exists", () => {
    const metrics = computePromotionMetrics({
      videoId: "video-single",
      snapshots: [makeSnapshot("video-single", "2026-07-26T06:00:00.000Z", 100)],
      currentViewCount: 100,
      subscriberCount: 1_000,
      firstDiscoveredAt: "2026-07-26T00:00:00.000Z",
      referenceEndMs: REFERENCE_END_MS,
    });

    expect(metrics.snapshotQuality).toBe("unavailable");
    expect(metrics.v1h).toBeNull();
  });

  it("detects low recent velocity on a large viral video", () => {
    const metrics = computePromotionMetrics({
      videoId: "video-viral",
      snapshots: viralSnapshots,
      currentViewCount: 5_054_100,
      subscriberCount: 1_000_000,
      firstDiscoveredAt: "2026-07-20T00:00:00.000Z",
      genreBaseline: defaultGenreBaseline,
      referenceEndMs: REFERENCE_END_MS,
    });

    expect(metrics.v1h).not.toBeNull();
    expect(metrics.v1h!).toBeLessThan(1_000);
    expect(metrics.absoluteSizePenalty).toBeGreaterThan(5);
  });

  it("captures deceleration on a declining snapshot series", () => {
    const metrics = computePromotionMetrics({
      videoId: "video-declining",
      snapshots: decliningSnapshots,
      currentViewCount: 1_070,
      subscriberCount: 5_000,
      firstDiscoveredAt: "2026-07-25T00:00:00.000Z",
      referenceEndMs: REFERENCE_END_MS,
    });

    expect(metrics.acceleration).not.toBeNull();
    expect(metrics.acceleration!).toBeLessThan(0);
  });
});
