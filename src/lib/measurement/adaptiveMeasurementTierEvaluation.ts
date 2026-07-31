import {
  ADAPTIVE_MEASUREMENT_CONFIG,
  type AdaptiveMeasurementTier,
} from "@/lib/measurement/adaptiveMeasurementConfig";
import type { WatchTier } from "@/types/observability";

export interface AdaptiveMeasurementSignals {
  hoursSincePublish: number | null;
  v1h: number | null;
  velocityChangeRate: number | null;
  viewsGainedSinceLastMeasure: number | null;
  hoursSinceLastMeasure: number | null;
  /** View growth across the configured stale window (default 24h). */
  viewsGainedInStaleWindow: number | null;
  /** Hours covered from the stale-window baseline snapshot to now. */
  staleWindowHours: number | null;
  watchlistTier: WatchTier | null;
  hasRankingDiscovery: boolean;
  snapshotCount: number;
}

export interface InitialAdaptiveMeasurementInput {
  hoursSincePublish: number | null;
  watchlistTier?: WatchTier | null;
  hasRankingDiscovery?: boolean;
}

export interface AdaptiveMeasurementTierDecision {
  tier: AdaptiveMeasurementTier;
  reason: string;
}

function isFreshPublish(
  hoursSincePublish: number | null,
  config: typeof ADAPTIVE_MEASUREMENT_CONFIG,
): boolean {
  return (
    hoursSincePublish !== null &&
    hoursSincePublish <= config.freshPublishHours
  );
}

function isRising(
  signals: AdaptiveMeasurementSignals,
  config: typeof ADAPTIVE_MEASUREMENT_CONFIG,
): boolean {
  return (
    signals.v1h !== null &&
    signals.v1h >= config.risingMinViewsPerHour &&
    signals.velocityChangeRate !== null &&
    signals.velocityChangeRate >= config.risingVelocityChangeRate
  );
}

function isStale(
  signals: AdaptiveMeasurementSignals,
  config: typeof ADAPTIVE_MEASUREMENT_CONFIG,
): boolean {
  const lowVelocity =
    signals.v1h !== null && signals.v1h <= config.lowMaxViewsPerHour;
  const noGainInStaleWindow =
    signals.viewsGainedInStaleWindow !== null &&
    signals.viewsGainedInStaleWindow <= config.staleMaxViewsGained;
  const staleWindowLongEnough =
    signals.staleWindowHours !== null &&
    signals.staleWindowHours >= config.staleHours;

  return lowVelocity && noGainInStaleWindow && staleWindowLongEnough;
}

function watchlistTierFloor(
  watchlistTier: WatchTier | null,
): AdaptiveMeasurementTier | null {
  if (watchlistTier === "hot") {
    return "high";
  }
  if (watchlistTier === "active") {
    return "normal";
  }
  return null;
}

function applySignalBoosts(
  baseTier: AdaptiveMeasurementTier,
  signals: AdaptiveMeasurementSignals,
): AdaptiveMeasurementTier {
  const tierRank: Record<AdaptiveMeasurementTier, number> = {
    archive: 0,
    low: 1,
    normal: 2,
    high: 3,
    critical: 4,
  };

  let tier = baseTier;

  const floor = watchlistTierFloor(signals.watchlistTier);
  if (floor && tierRank[floor] > tierRank[tier]) {
    tier = floor;
  }

  if (signals.hasRankingDiscovery && tierRank.high > tierRank[tier]) {
    tier = "high";
  }

  return tier;
}

export function evaluateAdaptiveMeasurementTier(
  signals: AdaptiveMeasurementSignals,
  config: typeof ADAPTIVE_MEASUREMENT_CONFIG = ADAPTIVE_MEASUREMENT_CONFIG,
): AdaptiveMeasurementTierDecision {
  if (isFreshPublish(signals.hoursSincePublish, config)) {
    return {
      tier: applySignalBoosts("critical", signals),
      reason: `freshPublishHours<=${config.freshPublishHours}`,
    };
  }

  if (isRising(signals, config)) {
    return {
      tier: applySignalBoosts("high", signals),
      reason: [
        `v1h=${signals.v1h ?? "null"}`,
        `velocityChangeRate=${signals.velocityChangeRate ?? "null"}`,
      ].join(", "),
    };
  }

  if (isStale(signals, config)) {
    return {
      tier: "archive",
      reason: [
        `v1h=${signals.v1h ?? "null"}`,
        `viewsGainedInStaleWindow=${signals.viewsGainedInStaleWindow ?? "null"}`,
        `staleWindowHours=${signals.staleWindowHours ?? "null"}`,
      ].join(", "),
    };
  }

  if (signals.v1h !== null && signals.v1h <= config.lowMaxViewsPerHour) {
    return {
      tier: applySignalBoosts("low", signals),
      reason: `v1h<=${config.lowMaxViewsPerHour}`,
    };
  }

  return {
    tier: applySignalBoosts("normal", signals),
    reason: "default_normal",
  };
}

export function evaluateInitialAdaptiveMeasurementTier(
  input: InitialAdaptiveMeasurementInput | number | null,
  config: typeof ADAPTIVE_MEASUREMENT_CONFIG = ADAPTIVE_MEASUREMENT_CONFIG,
): AdaptiveMeasurementTierDecision {
  const normalizedInput: InitialAdaptiveMeasurementInput =
    typeof input === "number" || input === null
      ? { hoursSincePublish: input }
      : input;

  const baseTier: AdaptiveMeasurementTier = isFreshPublish(
    normalizedInput.hoursSincePublish,
    config,
  )
    ? "critical"
    : "normal";
  const baseReason = isFreshPublish(normalizedInput.hoursSincePublish, config)
    ? `initial_freshPublishHours<=${config.freshPublishHours}`
    : "initial_default_normal";

  const tier = applySignalBoosts(baseTier, {
    hoursSincePublish: normalizedInput.hoursSincePublish,
    v1h: null,
    velocityChangeRate: null,
    viewsGainedSinceLastMeasure: null,
    hoursSinceLastMeasure: null,
    viewsGainedInStaleWindow: null,
    staleWindowHours: null,
    watchlistTier: normalizedInput.watchlistTier ?? null,
    hasRankingDiscovery: normalizedInput.hasRankingDiscovery ?? false,
    snapshotCount: 0,
  });

  if (tier !== baseTier) {
    return {
      tier,
      reason: `${baseReason},boost=${tier}`,
    };
  }

  return {
    tier,
    reason: baseReason,
  };
}
