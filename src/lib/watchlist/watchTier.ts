import {
  WATCH_TIER_CHECK_INTERVAL_MS,
  WATCH_TIER_SUBSCRIBER_THRESHOLDS,
  type PollableWatchTier,
} from "@/lib/watchlist/watchTierConfig";
import type { WatchTier } from "@/types/observability";
import { isWatchTier } from "@/types/observability";

/**
 * Initial watch_tier from subscriber count at Watchlist registration time.
 * Performance-based promotion/demotion is Phase 4 (Auto Watchlist).
 */
export function determineInitialWatchTier(
  subscriberCount: number | null | undefined,
  thresholds: typeof WATCH_TIER_SUBSCRIBER_THRESHOLDS = WATCH_TIER_SUBSCRIBER_THRESHOLDS,
): WatchTier {
  if (subscriberCount === null || subscriberCount === undefined || subscriberCount < 0) {
    return "cold";
  }

  if (subscriberCount >= thresholds.hot) {
    return "hot";
  }
  if (subscriberCount >= thresholds.active) {
    return "active";
  }
  if (subscriberCount >= thresholds.normal) {
    return "normal";
  }

  return "cold";
}

export function getWatchTierCheckIntervalMs(
  tier: WatchTier,
  intervals: typeof WATCH_TIER_CHECK_INTERVAL_MS = WATCH_TIER_CHECK_INTERVAL_MS,
): number {
  if (!isWatchTier(tier)) {
    throw new Error(`Invalid watch tier: ${tier}`);
  }
  if (tier === "archive") {
    throw new Error("archive tier is excluded from watchlist polling");
  }

  return intervals[tier as PollableWatchTier];
}

export function computeNextWatchlistCheckAt(
  tier: WatchTier,
  from: Date,
  intervals: typeof WATCH_TIER_CHECK_INTERVAL_MS = WATCH_TIER_CHECK_INTERVAL_MS,
): Date {
  return new Date(from.getTime() + getWatchTierCheckIntervalMs(tier, intervals));
}
