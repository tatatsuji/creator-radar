import { PROMOTION_CONFIG } from "@/lib/promotion/config";
import type { PromotionMetrics } from "@/lib/promotion/metrics";
import type { PromotionState } from "@/types/observability";
import type { VelocityQuality } from "@/lib/observability/velocity";

export interface RadarScoreV2Input {
  metrics: PromotionMetrics;
  promotionState: PromotionState;
  currentViewCount: number;
}

function snapshotQualityMultiplier(quality: VelocityQuality): number {
  return PROMOTION_CONFIG.scoreV2.qualityMultipliers[quality];
}

function promotionStateMultiplier(state: PromotionState): number {
  return PROMOTION_CONFIG.scoreV2.promotionMultipliers[state];
}

export function computeEarlyDiscoveryBoost(discoveryAgeHours: number | null): number {
  if (discoveryAgeHours === null) {
    return 0;
  }

  const remainingHours = Math.max(
    PROMOTION_CONFIG.thresholds.earlyDiscoveryBoostHours - discoveryAgeHours,
    0,
  );

  return (remainingHours / PROMOTION_CONFIG.thresholds.earlyDiscoveryBoostHours) * 20;
}

export function computeAccelerationBoost(acceleration: number | null): number {
  if (acceleration === null || acceleration <= 0) {
    return 1;
  }

  return 1 + Math.min(acceleration, 2);
}

export function computeRadarScoreV2Raw(input: RadarScoreV2Input): number {
  const { metrics, promotionState, currentViewCount } = input;
  const weights = PROMOTION_CONFIG.scoreV2.weights;
  const v1h = Math.max(metrics.v1h ?? 0, 0);
  const viewsPerSub = Math.min(
    metrics.viewsPerSubscriber1h ?? 0,
    PROMOTION_CONFIG.scoreV2.maxViewsPerSubscriberForScore,
  );
  const genreComponent = Math.max(metrics.genreZScore ?? 0, 0);

  const velocityScore =
    Math.log10(v1h + 1) *
    weights.velocity *
    computeAccelerationBoost(metrics.acceleration);
  const ratioScore = Math.log10(Math.max(viewsPerSub, 0.001) + 1) * weights.viewsPerSubscriber;
  const genreScore = genreComponent * weights.genreZScore;
  const discoveryScore = computeEarlyDiscoveryBoost(metrics.discoveryAgeHours);
  const sizePenalty =
    Math.log10(Math.max(currentViewCount, 0) + 1) * weights.absoluteSizePenalty;

  const raw =
    velocityScore +
    ratioScore +
    genreScore +
    discoveryScore -
    sizePenalty;

  return raw * snapshotQualityMultiplier(metrics.snapshotQuality) * promotionStateMultiplier(promotionState);
}

export function computeRadarScoreV2(input: RadarScoreV2Input): number | null {
  if (input.metrics.snapshotQuality === "unavailable") {
    return null;
  }

  const raw = computeRadarScoreV2Raw(input);
  const normalized = Math.round(
    (raw / PROMOTION_CONFIG.scoreV2.scale) * 100,
  );

  return Math.min(100, Math.max(0, normalized));
}
