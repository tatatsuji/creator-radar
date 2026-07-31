import {
  getAdaptiveMeasurementIntervalMs,
  normalizeAdaptiveMeasurementTier,
} from "@/lib/measurement/adaptiveMeasurementConfig";
import type { MeasurementTier } from "@/types/observability";
import { isMeasurementTier } from "@/types/observability";

export const MEASUREMENT_INTERVAL_MS = {
  critical: 15 * 60 * 1000,
  high: 30 * 60 * 1000,
  normal: 60 * 60 * 1000,
  low: 6 * 60 * 60 * 1000,
  archive: 24 * 60 * 60 * 1000,
  hot: 1 * 60 * 60 * 1000,
  active: 3 * 60 * 60 * 1000,
  cold: 24 * 60 * 60 * 1000,
} as const satisfies Record<MeasurementTier, number>;

export const MEASUREMENT_FAILURE_THRESHOLD = 3;
export const MEASUREMENT_BACKOFF_BASE_MS = 15 * 60 * 1000;
export const MEASUREMENT_BACKOFF_MAX_MS = 24 * 60 * 60 * 1000;

export function getMeasurementIntervalMs(tier: MeasurementTier): number {
  if (!isMeasurementTier(tier)) {
    throw new Error(`Invalid measurement tier: ${tier}`);
  }

  if (tier === "critical" || tier === "high" || tier === "low" || tier === "archive") {
    return getAdaptiveMeasurementIntervalMs(tier);
  }

  if (tier === "normal") {
    return getAdaptiveMeasurementIntervalMs("normal");
  }

  return MEASUREMENT_INTERVAL_MS[tier];
}

export function normalizeMeasurementTierForScheduling(
  tier: MeasurementTier | string,
): MeasurementTier {
  const normalized = normalizeAdaptiveMeasurementTier(tier);
  return normalized as MeasurementTier;
}

export function computeNextMeasurementAtAfterSuccess(
  tier: MeasurementTier,
  from: Date,
): Date {
  return new Date(from.getTime() + getMeasurementIntervalMs(tier));
}

export function computeFailureBackoffNextAt(
  from: Date,
  failureCount: number,
): Date {
  if (failureCount <= 0) {
    throw new Error("failureCount must be positive");
  }

  const backoffMs = Math.min(
    failureCount * MEASUREMENT_BACKOFF_BASE_MS,
    MEASUREMENT_BACKOFF_MAX_MS,
  );
  return new Date(from.getTime() + backoffMs);
}

export function shouldMarkMeasurementFailed(failureCount: number): boolean {
  return failureCount >= MEASUREMENT_FAILURE_THRESHOLD;
}
