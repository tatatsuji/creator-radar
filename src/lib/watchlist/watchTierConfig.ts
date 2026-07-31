import type { WatchTier } from "@/types/observability";

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPositiveHours(value: string | undefined, fallbackHours: number): number {
  return readPositiveInt(value, fallbackHours) * 60 * 60 * 1000;
}

/** Subscriber count thresholds for initial watch_tier assignment. */
export const WATCH_TIER_SUBSCRIBER_THRESHOLDS = {
  hot: readPositiveInt(process.env.WATCH_TIER_HOT_MIN_SUBSCRIBERS, 1_000_000),
  active: readPositiveInt(process.env.WATCH_TIER_ACTIVE_MIN_SUBSCRIBERS, 500_000),
  normal: readPositiveInt(process.env.WATCH_TIER_NORMAL_MIN_SUBSCRIBERS, 100_000),
} as const;

export type PollableWatchTier = Exclude<WatchTier, "archive">;

/** Check interval per watch_tier (used for next_check_at after a successful poll). */
export const WATCH_TIER_CHECK_INTERVAL_MS = {
  hot: readPositiveHours(process.env.WATCH_TIER_HOT_CHECK_HOURS, 1),
  active: readPositiveHours(process.env.WATCH_TIER_ACTIVE_CHECK_HOURS, 3),
  normal: readPositiveHours(process.env.WATCH_TIER_NORMAL_CHECK_HOURS, 6),
  cold: readPositiveHours(process.env.WATCH_TIER_COLD_CHECK_HOURS, 12),
} as const satisfies Record<PollableWatchTier, number>;
