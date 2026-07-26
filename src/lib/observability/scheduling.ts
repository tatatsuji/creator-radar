import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";

/** Computes the next watchlist check time from a fixed base instant. */
export function computeDefaultNextCheckAt(
  from: Date,
  intervalMs: number = OBSERVABILITY_CONFIG.defaultNextCheckIntervalMs,
): Date {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("intervalMs must be a positive number");
  }

  return new Date(from.getTime() + intervalMs);
}

/** Computes the next measurement time from a fixed base instant. */
export function computeDefaultNextMeasurementAt(
  from: Date,
  intervalMs: number = OBSERVABILITY_CONFIG.defaultNextMeasurementIntervalMs,
): Date {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("intervalMs must be a positive number");
  }

  return new Date(from.getTime() + intervalMs);
}
