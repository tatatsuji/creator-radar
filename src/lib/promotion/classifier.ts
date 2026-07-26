import { PROMOTION_CONFIG } from "@/lib/promotion/config";
import type { GenreVelocityBaseline, PromotionMetrics } from "@/lib/promotion/metrics";
import type {
  MeasurementTier,
  PromotionReason,
  PromotionState,
  TierSyncMode,
} from "@/types/observability";

export interface PromotionClassificationInput {
  metrics: PromotionMetrics;
  previousState: PromotionState | null;
  consecutiveRuns: number;
  currentMeasurementTier: MeasurementTier;
  currentViewCount: number;
  genreBaseline?: GenreVelocityBaseline | null;
  tierSyncMode?: TierSyncMode;
}

export interface CandidatePromotionState {
  state: PromotionState;
  reason: PromotionReason | null;
  tags: string[];
}

export interface PromotionClassificationResult {
  promotionState: PromotionState;
  previousState: PromotionState | null;
  consecutiveRuns: number;
  recommendedMeasurementTier: MeasurementTier;
  promotionReason: PromotionReason | null;
  promotionTags: string[];
  tierSyncMode: TierSyncMode;
  candidateState: PromotionState;
}

function hasUsableVelocity(metrics: PromotionMetrics): boolean {
  return metrics.snapshotQuality !== "unavailable" && metrics.v1h !== null;
}

function hasRecentAcceleration(metrics: PromotionMetrics): boolean {
  if ((metrics.velocityChangeRate ?? 0) > PROMOTION_CONFIG.thresholds.risingMinAcceleration) {
    return true;
  }

  return (metrics.accelerationPerHour ?? 0) > 0;
}

export function mapRecommendedMeasurementTier(
  promotionState: PromotionState,
): MeasurementTier {
  return PROMOTION_CONFIG.recommendedTierByState[promotionState];
}

export function computeCandidatePromotionState(
  metrics: PromotionMetrics,
  currentViewCount: number,
  genreBaseline: GenreVelocityBaseline | null | undefined = null,
): CandidatePromotionState {
  if (!hasUsableVelocity(metrics)) {
    return {
      state: "STABLE",
      reason: null,
      tags: ["insufficient_velocity"],
    };
  }

  const v1h = metrics.v1h!;
  const v3h = metrics.v3h;
  const tags: string[] = [];

  if (
    v3h !== null &&
    v3h > 0 &&
    v1h < v3h * PROMOTION_CONFIG.thresholds.decliningVelocityRatio
  ) {
    return {
      state: "DECLINING",
      reason: "velocity_threshold",
      tags: ["deceleration"],
    };
  }

  const genreReady =
    (genreBaseline?.sampleCount ?? 0) >=
    PROMOTION_CONFIG.thresholds.minGenreBaselineSampleCount;

  if (
    genreReady &&
    genreBaseline &&
    v1h >=
      genreBaseline.p90ViewsPerHour1h *
        PROMOTION_CONFIG.thresholds.hotGenreP90Multiplier &&
    currentViewCount <= PROMOTION_CONFIG.thresholds.hotMaxViewCount
  ) {
    return {
      state: "HOT",
      reason: "velocity_threshold",
      tags: ["above_genre_p90", "early_breakout"],
    };
  }

  if (
    metrics.selfRollingAvg1h !== null &&
    v1h > metrics.selfRollingAvg1h * PROMOTION_CONFIG.thresholds.risingSelfMultiplier &&
    hasRecentAcceleration(metrics)
  ) {
    tags.push("acceleration", "above_self_average");
    return {
      state: "RISING",
      reason: "velocity_threshold",
      tags,
    };
  }

  if (
    genreReady &&
    genreBaseline &&
    metrics.v24h !== null &&
    metrics.v24h >
      genreBaseline.medianViewsPerHour24h *
        PROMOTION_CONFIG.thresholds.trendingGenreMedianMultiplier
  ) {
    return {
      state: "TRENDING",
      reason: "velocity_threshold",
      tags: ["sustained_growth"],
    };
  }

  if ((metrics.selfZScore ?? 0) > 1) {
    tags.push("self_outlier");
  }

  return {
    state: "STABLE",
    reason: null,
    tags: tags.length > 0 ? tags : ["baseline"],
  };
}

export function applyPromotionHysteresis(
  candidate: CandidatePromotionState,
  previousState: PromotionState | null,
  candidateConsecutiveRuns: number,
): { promotionState: PromotionState; consecutiveRuns: number } {
  const nextConsecutiveRuns = Math.max(candidateConsecutiveRuns, 0) + 1;
  const hysteresisStates: PromotionState[] = ["HOT", "TRENDING", "DECLINING"];

  if (previousState === null) {
    if (
      hysteresisStates.includes(candidate.state) &&
      nextConsecutiveRuns < PROMOTION_CONFIG.thresholds.hysteresisRuns
    ) {
      return {
        promotionState: "STABLE",
        consecutiveRuns: nextConsecutiveRuns,
      };
    }

    return {
      promotionState: candidate.state,
      consecutiveRuns: nextConsecutiveRuns,
    };
  }

  if (candidate.state === previousState) {
    return {
      promotionState: previousState,
      consecutiveRuns: nextConsecutiveRuns,
    };
  }

  if (!hysteresisStates.includes(candidate.state)) {
    return {
      promotionState: candidate.state,
      consecutiveRuns: nextConsecutiveRuns,
    };
  }

  if (nextConsecutiveRuns < PROMOTION_CONFIG.thresholds.hysteresisRuns) {
    return {
      promotionState: previousState,
      consecutiveRuns: nextConsecutiveRuns,
    };
  }

  return {
    promotionState: candidate.state,
    consecutiveRuns: nextConsecutiveRuns,
  };
}

export function classifyPromotion(
  input: PromotionClassificationInput,
): PromotionClassificationResult {
  const tierSyncMode = input.tierSyncMode ?? PROMOTION_CONFIG.tierSyncMode;
  const candidate = computeCandidatePromotionState(
    input.metrics,
    input.currentViewCount,
    input.genreBaseline,
  );
  const hysteresis = applyPromotionHysteresis(
    candidate,
    input.previousState,
    input.consecutiveRuns,
  );

  return {
    promotionState: hysteresis.promotionState,
    previousState: input.previousState,
    consecutiveRuns: hysteresis.consecutiveRuns,
    recommendedMeasurementTier: mapRecommendedMeasurementTier(
      hysteresis.promotionState,
    ),
    promotionReason: candidate.reason,
    promotionTags: candidate.tags,
    tierSyncMode,
    candidateState: candidate.state,
  };
}
