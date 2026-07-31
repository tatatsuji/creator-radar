import {
  ADAPTIVE_MEASUREMENT_CONFIG,
  estimateDailyMeasurementCalls,
  getAdaptiveMeasurementIntervalMs,
  normalizeAdaptiveMeasurementTier,
  type AdaptiveMeasurementTier,
} from "@/lib/measurement/adaptiveMeasurementConfig";

export interface AdaptiveMeasurementQuotaEstimate {
  baselineDailyCalls: number;
  adaptiveDailyCalls: number;
  savedDailyCalls: number;
}

export function estimateAdaptiveMeasurementQuota(
  previousTier: string,
  nextTier: AdaptiveMeasurementTier,
  config: typeof ADAPTIVE_MEASUREMENT_CONFIG = ADAPTIVE_MEASUREMENT_CONFIG,
): AdaptiveMeasurementQuotaEstimate {
  const baselineDailyCalls = estimateDailyMeasurementCalls(
    config.baselineIntervalMs,
  );
  const adaptiveDailyCalls = estimateDailyMeasurementCalls(
    getAdaptiveMeasurementIntervalMs(nextTier),
  );

  return {
    baselineDailyCalls,
    adaptiveDailyCalls,
    savedDailyCalls: Math.max(0, baselineDailyCalls - adaptiveDailyCalls),
  };
}

export function aggregateAdaptiveMeasurementQuota(
  estimates: AdaptiveMeasurementQuotaEstimate[],
): AdaptiveMeasurementQuotaEstimate {
  return estimates.reduce(
    (total, estimate) => ({
      baselineDailyCalls: total.baselineDailyCalls + estimate.baselineDailyCalls,
      adaptiveDailyCalls: total.adaptiveDailyCalls + estimate.adaptiveDailyCalls,
      savedDailyCalls: total.savedDailyCalls + estimate.savedDailyCalls,
    }),
    {
      baselineDailyCalls: 0,
      adaptiveDailyCalls: 0,
      savedDailyCalls: 0,
    },
  );
}

export function describeQuotaReduction(
  aggregate: AdaptiveMeasurementQuotaEstimate,
): string {
  const previousTierEquivalent = normalizeAdaptiveMeasurementTier("hot");
  void previousTierEquivalent;
  return [
    `baselineDailyCalls=${aggregate.baselineDailyCalls.toFixed(2)}`,
    `adaptiveDailyCalls=${aggregate.adaptiveDailyCalls.toFixed(2)}`,
    `savedDailyCalls=${aggregate.savedDailyCalls.toFixed(2)}`,
  ].join(", ");
}
