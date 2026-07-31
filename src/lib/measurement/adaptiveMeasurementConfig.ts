import type { MeasurementTier } from "@/types/observability";

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPositiveMinutes(value: string | undefined, fallbackMinutes: number): number {
  return readPositiveInt(value, fallbackMinutes) * 60 * 1000;
}

function readPositiveHours(value: string | undefined, fallbackHours: number): number {
  return readPositiveInt(value, fallbackHours) * 60 * 60 * 1000;
}

/** Adaptive measurement tiers used by Phase 11 scheduling. */
export const ADAPTIVE_MEASUREMENT_TIERS = [
  "critical",
  "high",
  "normal",
  "low",
  "archive",
] as const;

export type AdaptiveMeasurementTier = (typeof ADAPTIVE_MEASUREMENT_TIERS)[number];

export const ADAPTIVE_MEASUREMENT_INTERVAL_MS: Record<
  AdaptiveMeasurementTier,
  number
> = {
  critical: readPositiveMinutes(process.env.ADAPTIVE_MEASUREMENT_CRITICAL_MINUTES, 15),
  high: readPositiveMinutes(process.env.ADAPTIVE_MEASUREMENT_HIGH_MINUTES, 30),
  normal: readPositiveHours(process.env.ADAPTIVE_MEASUREMENT_NORMAL_HOURS, 1),
  low: readPositiveHours(process.env.ADAPTIVE_MEASUREMENT_LOW_HOURS, 6),
  archive: readPositiveHours(process.env.ADAPTIVE_MEASUREMENT_ARCHIVE_HOURS, 24),
};

/** Fixed baseline used to estimate quota savings (pre-adaptive hot tier). */
export const ADAPTIVE_MEASUREMENT_BASELINE_INTERVAL_MS = readPositiveHours(
  process.env.ADAPTIVE_MEASUREMENT_BASELINE_HOURS,
  1,
);

export const ADAPTIVE_MEASUREMENT_FRESH_PUBLISH_HOURS = readPositiveInt(
  process.env.ADAPTIVE_MEASUREMENT_FRESH_PUBLISH_HOURS,
  6,
);

export const ADAPTIVE_MEASUREMENT_RISING_VELOCITY_CHANGE_RATE = Number.parseFloat(
  process.env.ADAPTIVE_MEASUREMENT_RISING_VELOCITY_CHANGE_RATE ?? "0.5",
);

export const ADAPTIVE_MEASUREMENT_RISING_MIN_VIEWS_PER_HOUR = readPositiveInt(
  process.env.ADAPTIVE_MEASUREMENT_RISING_MIN_VIEWS_PER_HOUR,
  50,
);

export const ADAPTIVE_MEASUREMENT_LOW_MAX_VIEWS_PER_HOUR = readPositiveInt(
  process.env.ADAPTIVE_MEASUREMENT_LOW_MAX_VIEWS_PER_HOUR,
  5,
);

export const ADAPTIVE_MEASUREMENT_STALE_HOURS = readPositiveInt(
  process.env.ADAPTIVE_MEASUREMENT_STALE_HOURS,
  24,
);

export const ADAPTIVE_MEASUREMENT_STALE_MAX_VIEWS_GAINED = readPositiveInt(
  process.env.ADAPTIVE_MEASUREMENT_STALE_MAX_VIEWS_GAINED,
  0,
);

export const ADAPTIVE_MEASUREMENT_CONFIG = {
  intervalsMs: ADAPTIVE_MEASUREMENT_INTERVAL_MS,
  baselineIntervalMs: ADAPTIVE_MEASUREMENT_BASELINE_INTERVAL_MS,
  freshPublishHours: ADAPTIVE_MEASUREMENT_FRESH_PUBLISH_HOURS,
  risingVelocityChangeRate: Number.isFinite(
    ADAPTIVE_MEASUREMENT_RISING_VELOCITY_CHANGE_RATE,
  )
    ? ADAPTIVE_MEASUREMENT_RISING_VELOCITY_CHANGE_RATE
    : 0.5,
  risingMinViewsPerHour: ADAPTIVE_MEASUREMENT_RISING_MIN_VIEWS_PER_HOUR,
  lowMaxViewsPerHour: ADAPTIVE_MEASUREMENT_LOW_MAX_VIEWS_PER_HOUR,
  staleHours: ADAPTIVE_MEASUREMENT_STALE_HOURS,
  staleMaxViewsGained: ADAPTIVE_MEASUREMENT_STALE_MAX_VIEWS_GAINED,
} as const;

const LEGACY_MEASUREMENT_TIER_MAP: Record<string, AdaptiveMeasurementTier> = {
  hot: "high",
  active: "high",
  normal: "normal",
  cold: "low",
  critical: "critical",
  high: "high",
  low: "low",
  archive: "archive",
};

export function isAdaptiveMeasurementTier(
  value: string,
): value is AdaptiveMeasurementTier {
  return ADAPTIVE_MEASUREMENT_TIERS.includes(value as AdaptiveMeasurementTier);
}

export function normalizeAdaptiveMeasurementTier(
  tier: MeasurementTier | string,
): AdaptiveMeasurementTier {
  return LEGACY_MEASUREMENT_TIER_MAP[tier] ?? "normal";
}

export function getAdaptiveMeasurementIntervalMs(
  tier: MeasurementTier | AdaptiveMeasurementTier | string,
): number {
  const normalized = normalizeAdaptiveMeasurementTier(tier);
  return ADAPTIVE_MEASUREMENT_INTERVAL_MS[normalized];
}

export function estimateDailyMeasurementCalls(intervalMs: number): number {
  if (intervalMs <= 0) {
    return 0;
  }
  return (24 * 60 * 60 * 1000) / intervalMs;
}
