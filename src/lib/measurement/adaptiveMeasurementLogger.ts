import type { AdaptiveMeasurementTier } from "@/lib/measurement/adaptiveMeasurementConfig";

export interface AdaptiveMeasurementTierChangeLog {
  videoId: string;
  previousTier: string;
  nextTier: AdaptiveMeasurementTier;
  reason: string;
  timestamp: string;
}

export function logAdaptiveMeasurementTierChange(
  entry: Omit<AdaptiveMeasurementTierChangeLog, "timestamp">,
): void {
  const payload: AdaptiveMeasurementTierChangeLog = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  console.info(`[AdaptiveMeasurement:TIER] ${JSON.stringify(payload)}`);
}
