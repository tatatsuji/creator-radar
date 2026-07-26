import {
  analyzeVideoVelocity,
  computeVelocitySample,
  type VelocityQuality,
} from "@/lib/observability/velocity";
import { PROMOTION_CONFIG } from "@/lib/promotion/config";
import { computeLatestSnapshotGrowth } from "@/lib/snapshots/snapshotGrowth";
import type { VideoSnapshotRow } from "@/types/database";

export interface GenreVelocityBaseline {
  medianViewsPerHour1h: number;
  p90ViewsPerHour1h: number;
  medianViewsPerHour24h: number;
  sampleCount: number;
}

export interface PromotionMetricsInput {
  videoId: string;
  snapshots: VideoSnapshotRow[];
  currentViewCount: number;
  subscriberCount: number | null;
  subscriberCountHidden?: boolean;
  firstDiscoveredAt: string | null;
  genreBaseline?: GenreVelocityBaseline | null;
  referenceEndMs?: number;
}

export interface PromotionMetrics {
  videoId: string;
  snapshotQuality: VelocityQuality;
  v1h: number | null;
  v3h: number | null;
  v24h: number | null;
  /** Relative change vs prior interval velocity (same as velocityChangeRate). */
  acceleration: number | null;
  velocityChangeAbsolute: number | null;
  velocityChangeRate: number | null;
  accelerationPerHour: number | null;
  selfRollingAvg1h: number | null;
  selfZScore: number | null;
  genreZScore: number | null;
  viewsPerSubscriber1h: number | null;
  discoveryAgeHours: number | null;
  absoluteSizePenalty: number;
  measuredSampleCount: number;
}

function getSampleViewsPerHour(
  snapshots: VideoSnapshotRow[],
  windowHours: 1 | 3 | 24,
  referenceEndMs: number,
): { viewsPerHour: number | null; quality: VelocityQuality } {
  const sample = computeVelocitySample(snapshots, windowHours, referenceEndMs);
  return {
    viewsPerHour: sample.viewsPerHour,
    quality: sample.quality,
  };
}

/**
 * Average views/hour over the 2-hour window immediately before the latest hour,
 * derived from the 1h and 3h window velocities.
 */
export function computePriorIntervalVelocity(
  v1h: number | null,
  v3h: number | null,
): number | null {
  if (v1h === null || v3h === null) {
    return null;
  }

  const priorVelocity = (3 * v3h - v1h) / 2;
  return priorVelocity > 0 ? priorVelocity : null;
}

export function computeVelocityChangeAbsolute(
  v1h: number | null,
  v3h: number | null,
): number | null {
  const priorVelocity = computePriorIntervalVelocity(v1h, v3h);
  if (v1h === null || priorVelocity === null) {
    return null;
  }

  return v1h - priorVelocity;
}

export function computeVelocityChangeRate(
  v1h: number | null,
  v3h: number | null,
): number | null {
  const priorVelocity = computePriorIntervalVelocity(v1h, v3h);
  if (v1h === null || priorVelocity === null) {
    if (v1h === null) {
      return null;
    }
    return v1h > 0 ? null : 0;
  }

  return (v1h - priorVelocity) / priorVelocity;
}

/** Backward-compatible alias for relative velocity change vs the prior interval. */
export function computeAcceleration(
  v1h: number | null,
  v3h: number | null,
): number | null {
  return computeVelocityChangeRate(v1h, v3h);
}

export function computeSelfRollingAverage1h(
  snapshots: VideoSnapshotRow[],
  referenceEndMs: number = Date.now(),
): number | null {
  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );

  const velocities: number[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    const elapsedHours =
      (Date.parse(end.captured_at) - Date.parse(start.captured_at)) /
      (60 * 60 * 1000);

    if (elapsedHours <= 0) {
      continue;
    }

    if (Date.parse(end.captured_at) > referenceEndMs) {
      continue;
    }

    velocities.push((end.view_count - start.view_count) / elapsedHours);
  }

  if (velocities.length === 0) {
    return null;
  }

  return velocities.reduce((sum, value) => sum + value, 0) / velocities.length;
}

export function computeSelfZScore(
  v1h: number | null,
  rollingAvg1h: number | null,
  rollingSamples: number[],
): number | null {
  if (v1h === null || rollingAvg1h === null) {
    return null;
  }

  if (rollingSamples.length < 2) {
    const denominator = Math.max(Math.abs(rollingAvg1h), 1);
    return (v1h - rollingAvg1h) / denominator;
  }

  const mean =
    rollingSamples.reduce((sum, value) => sum + value, 0) / rollingSamples.length;
  const variance =
    rollingSamples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    rollingSamples.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev <= 0) {
    const denominator = Math.max(Math.abs(rollingAvg1h), 1);
    return (v1h - rollingAvg1h) / denominator;
  }

  return (v1h - mean) / stdDev;
}

export function computeGenreZScore(
  v1h: number | null,
  baseline: GenreVelocityBaseline | null | undefined,
): number | null {
  if (v1h === null || !baseline) {
    return null;
  }

  if (baseline.sampleCount < PROMOTION_CONFIG.thresholds.minGenreBaselineSampleCount) {
    return null;
  }

  const denominator = Math.max(baseline.medianViewsPerHour1h, 1);
  return (v1h - baseline.medianViewsPerHour1h) / denominator;
}

export function computeViewsPerSubscriber1h(
  v1h: number | null,
  subscriberCount: number | null,
  subscriberCountHidden = false,
): number | null {
  if (v1h === null || subscriberCountHidden || subscriberCount === null || subscriberCount <= 0) {
    return null;
  }

  return v1h / subscriberCount;
}

export function computeDiscoveryAgeHours(
  firstDiscoveredAt: string | null,
  referenceEndMs: number = Date.now(),
): number | null {
  if (!firstDiscoveredAt) {
    return null;
  }

  const ageHours =
    (referenceEndMs - Date.parse(firstDiscoveredAt)) / (60 * 60 * 1000);

  return ageHours >= 0 ? ageHours : null;
}

export function computeAbsoluteSizePenalty(viewCount: number): number {
  return Math.log10(Math.max(viewCount, 0) + 1);
}

function collectRolling1hVelocities(
  snapshots: VideoSnapshotRow[],
  referenceEndMs: number,
): number[] {
  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );
  const velocities: number[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    const elapsedHours =
      (Date.parse(end.captured_at) - Date.parse(start.captured_at)) /
      (60 * 60 * 1000);

    if (elapsedHours <= 0 || Date.parse(end.captured_at) > referenceEndMs) {
      continue;
    }

    velocities.push((end.view_count - start.view_count) / elapsedHours);
  }

  return velocities;
}

export function computePromotionMetrics(
  input: PromotionMetricsInput,
): PromotionMetrics {
  const referenceEndMs = input.referenceEndMs ?? Date.now();
  const analysis = analyzeVideoVelocity(
    input.videoId,
    input.snapshots,
    referenceEndMs,
  );

  const sample1h = getSampleViewsPerHour(input.snapshots, 1, referenceEndMs);
  const sample3h = getSampleViewsPerHour(input.snapshots, 3, referenceEndMs);
  const sample24h = getSampleViewsPerHour(input.snapshots, 24, referenceEndMs);
  const rollingSamples = collectRolling1hVelocities(
    input.snapshots,
    referenceEndMs,
  );
  const rollingAvg1h = computeSelfRollingAverage1h(
    input.snapshots,
    referenceEndMs,
  );

  const v1h = sample1h.viewsPerHour;
  const v3h = sample3h.viewsPerHour;
  const velocityChangeAbsolute = computeVelocityChangeAbsolute(v1h, v3h);
  const velocityChangeRate = computeVelocityChangeRate(v1h, v3h);
  const latestGrowth = computeLatestSnapshotGrowth(input.snapshots);
  const accelerationPerHour =
    latestGrowth?.status === "measured" ? latestGrowth.acceleration : null;

  return {
    videoId: input.videoId,
    snapshotQuality: sample1h.quality,
    v1h,
    v3h,
    v24h: sample24h.viewsPerHour,
    acceleration: velocityChangeRate,
    velocityChangeAbsolute,
    velocityChangeRate,
    accelerationPerHour,
    selfRollingAvg1h: rollingAvg1h,
    selfZScore: computeSelfZScore(
      sample1h.viewsPerHour,
      rollingAvg1h,
      rollingSamples,
    ),
    genreZScore: computeGenreZScore(sample1h.viewsPerHour, input.genreBaseline),
    viewsPerSubscriber1h: computeViewsPerSubscriber1h(
      sample1h.viewsPerHour,
      input.subscriberCount,
      input.subscriberCountHidden,
    ),
    discoveryAgeHours: computeDiscoveryAgeHours(
      input.firstDiscoveredAt,
      referenceEndMs,
    ),
    absoluteSizePenalty: computeAbsoluteSizePenalty(input.currentViewCount),
    measuredSampleCount: analysis.samples.filter(
      (sample) => sample.quality === "measured",
    ).length,
  };
}
