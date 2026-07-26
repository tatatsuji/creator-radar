import { formatViewsPerHour } from "@/lib/ranking/engines/buzzRanking";
import {
  normalizeLog,
  normalizeRatio,
  weightedAverage,
  type WeightedComponent,
} from "@/lib/ranking/scoreNormalization";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import type { PromotionMetrics } from "@/lib/promotion/metrics";
import { computeLatestSnapshotGrowth } from "@/lib/snapshots/snapshotGrowth";
import { MIN_SNAPSHOTS_FOR_EARLY_RISE } from "@/types/ranking";

const WEIGHTS = {
  acceleration: 0.4,
  velocityChange: 0.3,
  currentVelocity: 0.2,
  selfBaseline: 0.1,
} as const;

/** Ignore floating-point noise from equal 1h/3h window velocities. */
const MIN_VELOCITY_CHANGE_RATE = 0.05;
const MIN_VELOCITY_CHANGE_ABSOLUTE = 5;
const MIN_DECELERATION_EXCLUSION_ABSOLUTE = 10;

export interface EarlyRiseScoreBreakdown {
  acceleration: number | null;
  velocityChange: number | null;
  currentVelocity: number | null;
  selfBaseline: number | null;
  score: number | null;
}

function resolveVelocityChange(
  metrics: PromotionMetrics,
  entry: SnapshotEnrichedVideo,
): { absolute: number | null; rate: number | null } {
  const latestGrowth = computeLatestSnapshotGrowth(entry.snapshots);

  const windowAbsolute = metrics.velocityChangeAbsolute;
  const windowRate = metrics.velocityChangeRate;

  const pairAbsolute =
    latestGrowth?.status === "measured" ? latestGrowth.velocityChange : null;
  let pairRate: number | null = null;
  if (latestGrowth?.status === "measured") {
    const previous = latestGrowth.previousViewsPerHour;
    const current = latestGrowth.viewsPerHour;
    if (previous !== null && previous > 0 && current !== null) {
      pairRate = (current - previous) / previous;
    }
  }

  const windowIsFlat =
    Math.abs(windowRate ?? 0) < MIN_VELOCITY_CHANGE_RATE &&
    Math.abs(windowAbsolute ?? 0) < MIN_VELOCITY_CHANGE_ABSOLUTE;

  if (windowIsFlat && (pairAbsolute !== null || pairRate !== null)) {
    return { absolute: pairAbsolute, rate: pairRate };
  }

  return { absolute: windowAbsolute, rate: windowRate };
}

function hasMeaningfulAcceleration(
  absolute: number | null,
  rate: number | null,
  latestGrowth: ReturnType<typeof computeLatestSnapshotGrowth>,
): boolean {
  if (rate !== null && rate >= MIN_VELOCITY_CHANGE_RATE) {
    return true;
  }

  if (absolute !== null && absolute >= MIN_VELOCITY_CHANGE_ABSOLUTE) {
    return true;
  }

  if (
    latestGrowth?.status === "measured" &&
    (latestGrowth.velocityChange ?? 0) >= MIN_VELOCITY_CHANGE_ABSOLUTE
  ) {
    return true;
  }

  return false;
}

export function isEarlyRiseEligible(entry: SnapshotEnrichedVideo): boolean {
  if (entry.snapshots.length < MIN_SNAPSHOTS_FOR_EARLY_RISE) {
    return false;
  }

  const metrics = entry.promotionMetrics;
  if (!metrics || metrics.v1h === null || metrics.snapshotQuality === "unavailable") {
    return false;
  }

  const latestGrowth = computeLatestSnapshotGrowth(entry.snapshots);
  const { absolute, rate } = resolveVelocityChange(metrics, entry);

  if (
    latestGrowth?.status === "measured" &&
    (latestGrowth.velocityChange ?? 0) <= -MIN_DECELERATION_EXCLUSION_ABSOLUTE
  ) {
    return false;
  }

  return hasMeaningfulAcceleration(absolute, rate, latestGrowth);
}

export function countEarlyRiseEligible(enriched: SnapshotEnrichedVideo[]): number {
  return enriched.filter(isEarlyRiseEligible).length;
}

function buildEarlyRiseComponents(
  metrics: PromotionMetrics,
  entry: SnapshotEnrichedVideo,
): WeightedComponent[] {
  const { absolute, rate } = resolveVelocityChange(metrics, entry);

  const accelerationValue =
    rate !== null
      ? normalizeRatio(Math.max(rate, 0), 2)
      : metrics.accelerationPerHour !== null
        ? normalizeLog(Math.max(metrics.accelerationPerHour, 0), 500)
        : null;

  const velocityChangeValue =
    absolute !== null
      ? normalizeLog(Math.max(absolute, 0), 100_000)
      : metrics.accelerationPerHour !== null
        ? normalizeLog(Math.max(metrics.accelerationPerHour, 0), 500)
        : null;

  const currentVelocityValue =
    metrics.v1h !== null ? normalizeLog(metrics.v1h, 100_000) : null;

  const selfBaselineValue =
    metrics.selfRollingAvg1h !== null &&
    metrics.selfRollingAvg1h > 0 &&
    metrics.v1h !== null
      ? normalizeRatio(Math.max(metrics.v1h / metrics.selfRollingAvg1h - 1, 0), 2)
      : null;

  return [
    { value: accelerationValue, weight: WEIGHTS.acceleration },
    { value: velocityChangeValue, weight: WEIGHTS.velocityChange },
    { value: currentVelocityValue, weight: WEIGHTS.currentVelocity },
    { value: selfBaselineValue, weight: WEIGHTS.selfBaseline },
  ];
}

export function calculateEarlyRiseScore(
  entry: SnapshotEnrichedVideo,
): EarlyRiseScoreBreakdown {
  const metrics = entry.promotionMetrics;
  if (!metrics) {
    return {
      acceleration: null,
      velocityChange: null,
      currentVelocity: null,
      selfBaseline: null,
      score: null,
    };
  }

  const components = buildEarlyRiseComponents(metrics, entry);
  const score = weightedAverage(components);

  return {
    acceleration: components[0]?.value ?? null,
    velocityChange: components[1]?.value ?? null,
    currentVelocity: components[2]?.value ?? null,
    selfBaseline: components[3]?.value ?? null,
    score: score === null ? null : Math.round(score),
  };
}

export function buildEarlyRiseRankReason(entry: SnapshotEnrichedVideo): string {
  const metrics = entry.promotionMetrics!;
  const v1h = metrics.v1h ?? 0;
  const { absolute, rate } = resolveVelocityChange(metrics, entry);
  const selfAvg = metrics.selfRollingAvg1h;
  const ratio = selfAvg && selfAvg > 0 ? v1h / selfAvg : null;

  if (ratio !== null && ratio > 1.2) {
    return `直近1時間で再生速度が${ratio.toFixed(1)}倍 · 自己平均上振れ（実測）`;
  }

  if (absolute !== null && absolute >= MIN_VELOCITY_CHANGE_ABSOLUTE) {
    return `前区間より毎時${formatViewsPerHour(absolute)}回増加（実測）`;
  }

  if (rate !== null && rate >= MIN_VELOCITY_CHANGE_RATE) {
    if (rate >= 0.5) {
      return `急激な加速を検出 · ${formatViewsPerHour(v1h)}回/時（実測）`;
    }

    return `前区間比 ${(rate * 100).toFixed(0)}%加速 · ${formatViewsPerHour(v1h)}回/時（実測）`;
  }

  if (
    metrics.accelerationPerHour !== null &&
    metrics.accelerationPerHour >= MIN_VELOCITY_CHANGE_ABSOLUTE
  ) {
    return `急激な加速を検出 · ${formatViewsPerHour(v1h)}回/時（実測）`;
  }

  return `${formatViewsPerHour(v1h)}回/時 · 加速 ${rate !== null ? `${(rate * 100).toFixed(0)}%` : "検出"}（実測）`;
}

export function formatEarlyRiseSecondaryValue(entry: SnapshotEnrichedVideo): string {
  const metrics = entry.promotionMetrics;
  if (!metrics) {
    return "検出中";
  }

  const { absolute, rate } = resolveVelocityChange(metrics, entry);

  if (rate !== null && Math.abs(rate) >= MIN_VELOCITY_CHANGE_RATE) {
    return `${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(0)}%`;
  }

  if (absolute !== null && Math.abs(absolute) >= MIN_VELOCITY_CHANGE_ABSOLUTE) {
    return `+${formatViewsPerHour(Math.abs(absolute))}回/時`;
  }

  if (
    metrics.accelerationPerHour !== null &&
    Math.abs(metrics.accelerationPerHour) >= MIN_VELOCITY_CHANGE_ABSOLUTE
  ) {
    return `+${formatViewsPerHour(Math.abs(metrics.accelerationPerHour))}/h²`;
  }

  return "検出中";
}

export function getEarlyRiseMetricSummary(entry: SnapshotEnrichedVideo): Record<string, unknown> {
  const metrics = entry.promotionMetrics;
  const breakdown = calculateEarlyRiseScore(entry);
  const change = metrics ? resolveVelocityChange(metrics, entry) : { absolute: null, rate: null };

  return {
    score: breakdown.score,
    v1h: metrics?.v1h ?? null,
    velocityChangeAbsolute: metrics?.velocityChangeAbsolute ?? change.absolute,
    velocityChangeRate: metrics?.velocityChangeRate ?? change.rate,
    accelerationPerHour: metrics?.accelerationPerHour ?? null,
    selfBaselineRatio:
      metrics?.selfRollingAvg1h && metrics.v1h
        ? metrics.v1h / metrics.selfRollingAvg1h
        : null,
  };
}
