import type { GenreVelocityBaseline } from "@/lib/promotion/metrics";
import { formatViewsPerHour } from "@/lib/ranking/engines/buzzRanking";
import {
  normalizeLog,
  normalizeRatio,
  weightedAverage,
  type WeightedComponent,
} from "@/lib/ranking/scoreNormalization";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import { computeSnapshotGrowthSeries } from "@/lib/snapshots/snapshotGrowth";
import { MIN_SNAPSHOTS_FOR_POTENTIAL } from "@/types/ranking";

const WEIGHTS = {
  sustainedGrowth: 0.3,
  noSlowdown: 0.2,
  horizonVelocity: 0.2,
  subscriberRatio: 0.1,
  engagementGrowth: 0.1,
  confidence: 0.1,
} as const;

export interface PotentialScoreBreakdown {
  sustainedGrowth: number | null;
  noSlowdown: number | null;
  horizonVelocity: number | null;
  subscriberRatio: number | null;
  engagementGrowth: number | null;
  confidence: number | null;
  score: number | null;
}

function computePoolGenreBaseline(
  enriched: SnapshotEnrichedVideo[],
): GenreVelocityBaseline | null {
  const velocities = enriched
    .map((entry) => entry.promotionMetrics?.v1h)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((left, right) => left - right);

  if (velocities.length < 3) {
    return null;
  }

  const medianIndex = Math.floor(velocities.length / 2);
  const p90Index = Math.min(
    velocities.length - 1,
    Math.ceil(velocities.length * 0.9) - 1,
  );

  const v24Values = enriched
    .map((entry) => entry.promotionMetrics?.v24h)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((left, right) => left - right);
  const v24MedianIndex = Math.floor(v24Values.length / 2);

  return {
    medianViewsPerHour1h: velocities[medianIndex] ?? velocities[0]!,
    p90ViewsPerHour1h: velocities[p90Index] ?? velocities.at(-1)!,
    medianViewsPerHour24h: v24Values[v24MedianIndex] ?? velocities[medianIndex] ?? velocities[0]!,
    sampleCount: velocities.length,
  };
}

function computeSustainedGrowthScore(entry: SnapshotEnrichedVideo): number | null {
  const segments = computeSnapshotGrowthSeries(entry.snapshots).filter(
    (segment) => segment.status === "measured" && segment.viewsPerHour !== null,
  );

  if (segments.length < 2) {
    return null;
  }

  let sustained = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!.viewsPerHour!;
    const current = segments[index]!.viewsPerHour!;
    if (previous > 0 && current >= previous * 0.8) {
      sustained += 1;
    }
  }

  return (sustained / (segments.length - 1)) * 100;
}

function computeNoSlowdownScore(entry: SnapshotEnrichedVideo): number | null {
  const segments = computeSnapshotGrowthSeries(entry.snapshots).filter(
    (segment) => segment.status === "measured" && segment.viewsPerHour !== null,
  );

  if (segments.length < 2) {
    return null;
  }

  const latest = segments.at(-1)!;
  const prior = segments.at(-2)!;
  const latestVelocity = latest.viewsPerHour!;
  const priorVelocity = prior.viewsPerHour!;

  if (priorVelocity <= 0) {
    return latestVelocity > 0 ? 100 : 0;
  }

  const ratio = latestVelocity / priorVelocity;
  if (ratio >= 1) {
    return 100;
  }

  if (ratio >= 0.8) {
    return 70;
  }

  return normalizeRatio(ratio, 0.8);
}

function computeHorizonVelocityScore(
  entry: SnapshotEnrichedVideo,
  genreBaseline: GenreVelocityBaseline | null,
): number | null {
  const metrics = entry.promotionMetrics;
  if (!metrics) {
    return null;
  }

  const components: number[] = [];

  if (metrics.v3h !== null && metrics.v1h !== null && metrics.v1h > 0) {
    components.push(normalizeRatio(Math.min(metrics.v3h / metrics.v1h, 1.2), 1.2));
  }

  if (metrics.v24h !== null && metrics.v3h !== null && metrics.v3h > 0) {
    components.push(normalizeRatio(Math.min(metrics.v24h / metrics.v3h, 1.2), 1.2));
  }

  if (
    genreBaseline &&
    genreBaseline.sampleCount >= 3 &&
    metrics.v1h !== null &&
    genreBaseline.medianViewsPerHour1h > 0
  ) {
    components.push(
      normalizeRatio(metrics.v1h / genreBaseline.medianViewsPerHour1h, 3),
    );
  }

  if (components.length === 0) {
    return null;
  }

  return components.reduce((sum, value) => sum + value, 0) / components.length;
}

function computeEngagementGrowthScore(entry: SnapshotEnrichedVideo): number | null {
  const sorted = [...entry.snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );

  if (sorted.length < 2) {
    return null;
  }

  const baseline = sorted[0]!;
  const latest = sorted.at(-1)!;
  const elapsedHours = Math.max(
    (Date.parse(latest.captured_at) - Date.parse(baseline.captured_at)) / (60 * 60 * 1000),
    1,
  );

  const likeDelta =
    baseline.like_count !== null && latest.like_count !== null
      ? Math.max(0, latest.like_count - baseline.like_count)
      : null;
  const commentDelta =
    baseline.comment_count !== null && latest.comment_count !== null
      ? Math.max(0, latest.comment_count - baseline.comment_count)
      : null;

  if (likeDelta === null && commentDelta === null) {
    return null;
  }

  const engagementPerHour =
    ((likeDelta ?? 0) + (commentDelta ?? 0) * 5) / elapsedHours;

  return normalizeLog(engagementPerHour, 100);
}

function computeConfidenceScore(entry: SnapshotEnrichedVideo): number | null {
  const metrics = entry.promotionMetrics;
  if (!metrics) {
    return null;
  }

  const snapshotScore = normalizeRatio(entry.snapshots.length, 8);
  const measuredScore = normalizeRatio(metrics.measuredSampleCount, 6);
  const qualityScore = metrics.snapshotQuality === "measured" ? 100 : 40;

  return (snapshotScore + measuredScore + qualityScore) / 3;
}

export function isPotentialEligible(entry: SnapshotEnrichedVideo): boolean {
  if (entry.snapshots.length < MIN_SNAPSHOTS_FOR_POTENTIAL) {
    return false;
  }

  const metrics = entry.promotionMetrics;
  if (!metrics || metrics.v1h === null || metrics.snapshotQuality === "unavailable") {
    return false;
  }

  const sustained = computeSustainedGrowthScore(entry);
  const noSlowdown = computeNoSlowdownScore(entry);

  if (sustained === null && noSlowdown === null) {
    return false;
  }

  if (noSlowdown !== null && noSlowdown < 40) {
    return false;
  }

  return true;
}

export function countPotentialEligible(enriched: SnapshotEnrichedVideo[]): number {
  return enriched.filter(isPotentialEligible).length;
}

export function calculatePotentialScore(
  entry: SnapshotEnrichedVideo,
  pool: SnapshotEnrichedVideo[] = [],
): PotentialScoreBreakdown {
  const metrics = entry.promotionMetrics;
  if (!metrics) {
    return {
      sustainedGrowth: null,
      noSlowdown: null,
      horizonVelocity: null,
      subscriberRatio: null,
      engagementGrowth: null,
      confidence: null,
      score: null,
    };
  }

  const genreBaseline = computePoolGenreBaseline(pool.length > 0 ? pool : [entry]);
  const subscriberRatioValue =
    metrics.viewsPerSubscriber1h !== null
      ? normalizeLog(metrics.viewsPerSubscriber1h, 10)
      : null;

  const components: WeightedComponent[] = [
    { value: computeSustainedGrowthScore(entry), weight: WEIGHTS.sustainedGrowth },
    { value: computeNoSlowdownScore(entry), weight: WEIGHTS.noSlowdown },
    {
      value: computeHorizonVelocityScore(entry, genreBaseline),
      weight: WEIGHTS.horizonVelocity,
    },
    { value: subscriberRatioValue, weight: WEIGHTS.subscriberRatio },
    { value: computeEngagementGrowthScore(entry), weight: WEIGHTS.engagementGrowth },
    { value: computeConfidenceScore(entry), weight: WEIGHTS.confidence },
  ];

  const score = weightedAverage(components);

  return {
    sustainedGrowth: components[0]?.value ?? null,
    noSlowdown: components[1]?.value ?? null,
    horizonVelocity: components[2]?.value ?? null,
    subscriberRatio: components[3]?.value ?? null,
    engagementGrowth: components[4]?.value ?? null,
    confidence: components[5]?.value ?? null,
    score: score === null ? null : Math.round(score),
  };
}

export function buildPotentialRankReason(
  entry: SnapshotEnrichedVideo,
  pool: SnapshotEnrichedVideo[] = [],
): string {
  const metrics = entry.promotionMetrics!;
  const breakdown = calculatePotentialScore(entry, pool);
  const genreBaseline = computePoolGenreBaseline(pool.length > 0 ? pool : [entry]);
  const segments = computeSnapshotGrowthSeries(entry.snapshots).filter(
    (segment) => segment.status === "measured",
  );

  let sustainedIntervals = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!.viewsPerHour ?? 0;
    const current = segments[index]!.viewsPerHour ?? 0;
    if (previous > 0 && current >= previous * 0.8) {
      sustainedIntervals += 1;
    }
  }

  if (sustainedIntervals >= 2) {
    return `${sustainedIntervals + 1}区間連続で再生速度を維持（実測）`;
  }

  if ((breakdown.noSlowdown ?? 0) >= 80) {
    const hours = Math.round(
      (Date.parse(entry.snapshots.at(-1)!.captured_at) -
        Date.parse(entry.snapshots[0]!.captured_at)) /
        (60 * 60 * 1000),
    );
    return `直近${Math.max(hours, 1)}時間で失速なし · ${formatViewsPerHour(metrics.v1h ?? 0)}回/時（実測）`;
  }

  if (
    genreBaseline &&
    metrics.v1h !== null &&
    genreBaseline.medianViewsPerHour1h > 0 &&
    metrics.v1h / genreBaseline.medianViewsPerHour1h >= 1.2
  ) {
    const multiplier = metrics.v1h / genreBaseline.medianViewsPerHour1h;
    return `同ジャンル平均より${multiplier.toFixed(1)}倍速く成長（実測）`;
  }

  if (entry.snapshots.length >= 3) {
    return `実測${entry.snapshots.length}点 · 高信頼 · ${formatViewsPerHour(metrics.v1h ?? 0)}回/時`;
  }

  return `${formatViewsPerHour(metrics.v1h ?? 0)}回/時 · 持続性を確認中（実測）`;
}

export function getPotentialMetricSummary(
  entry: SnapshotEnrichedVideo,
  pool: SnapshotEnrichedVideo[] = [],
): Record<string, unknown> {
  const breakdown = calculatePotentialScore(entry, pool);
  const metrics = entry.promotionMetrics;

  return {
    score: breakdown.score,
    sustainedGrowth: breakdown.sustainedGrowth,
    noSlowdown: breakdown.noSlowdown,
    horizonVelocity: breakdown.horizonVelocity,
    subscriberRatio: breakdown.subscriberRatio,
    engagementGrowth: breakdown.engagementGrowth,
    confidence: breakdown.confidence,
    v1h: metrics?.v1h ?? null,
    v3h: metrics?.v3h ?? null,
    v24h: metrics?.v24h ?? null,
    snapshotCount: entry.snapshots.length,
  };
}
