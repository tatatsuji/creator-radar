import type { DiscoverySourceType } from "@/types/observability";
import type { DemotableWatchTier, PromotableWatchTier } from "@/lib/watchlist/autoWatchlist/watchTierOrder";

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPositiveDays(value: string | undefined, fallbackDays: number): number {
  return readPositiveInt(value, fallbackDays) * 24 * 60 * 60 * 1000;
}

/** Candidate-engine discovery sources treated as ranking-related performance signals. */
export const AUTO_WATCHLIST_RANKING_SOURCE_TYPES = [
  "search",
  "category_search",
  "most_popular",
  "short_form_candidate",
  "live_search",
  "shorts_search",
] as const satisfies readonly DiscoverySourceType[];

/** Sources that should not trigger auto-enrollment (already watchlist-managed). */
export const AUTO_WATCHLIST_ENROLLMENT_SKIP_SOURCE_TYPES = [
  "watchlist_upload",
  "seed_channel",
  "auto_watchlist",
] as const satisfies readonly DiscoverySourceType[];

/** Sources excluded from performance discovery counts (watchlist self-polling). */
export const AUTO_WATCHLIST_PERFORMANCE_EXCLUDED_SOURCE_TYPES = [
  "watchlist_upload",
  "auto_watchlist",
] as const satisfies readonly DiscoverySourceType[];

export const AUTO_WATCHLIST_PROMOTION_LOOKBACK_DAYS = readPositiveInt(
  process.env.AUTO_WATCHLIST_PROMOTION_LOOKBACK_DAYS,
  30,
);

export const AUTO_WATCHLIST_DEMOTION_LOOKBACK_DAYS = readPositiveInt(
  process.env.AUTO_WATCHLIST_DEMOTION_LOOKBACK_DAYS,
  30,
);

export const AUTO_WATCHLIST_RESTORE_LOOKBACK_DAYS = readPositiveInt(
  process.env.AUTO_WATCHLIST_RESTORE_LOOKBACK_DAYS,
  14,
);

export const AUTO_WATCHLIST_DEMOTION_INACTIVE_UPLOAD_DAYS = readPositiveInt(
  process.env.AUTO_WATCHLIST_DEMOTION_INACTIVE_UPLOAD_DAYS,
  30,
);

export const AUTO_WATCHLIST_RESTORE_RECENT_UPLOAD_DAYS = readPositiveInt(
  process.env.AUTO_WATCHLIST_RESTORE_RECENT_UPLOAD_DAYS,
  14,
);

/** Minimum performance discoveries in lookback to promote one tier step. */
export const AUTO_PROMOTION_TIER_THRESHOLDS: Record<
  PromotableWatchTier,
  {
    minDiscoveryCount: number;
    minRankingDiscoveryCount: number;
    minRisingDiscoveryCount: number;
  }
> = {
  cold: {
    minDiscoveryCount: readPositiveInt(process.env.AUTO_PROMOTION_COLD_DISCOVERY_COUNT, 2),
    minRankingDiscoveryCount: readPositiveInt(
      process.env.AUTO_PROMOTION_COLD_RANKING_COUNT,
      1,
    ),
    minRisingDiscoveryCount: readPositiveInt(process.env.AUTO_PROMOTION_COLD_RISING_COUNT, 1),
  },
  normal: {
    minDiscoveryCount: readPositiveInt(process.env.AUTO_PROMOTION_NORMAL_DISCOVERY_COUNT, 5),
    minRankingDiscoveryCount: readPositiveInt(
      process.env.AUTO_PROMOTION_NORMAL_RANKING_COUNT,
      2,
    ),
    minRisingDiscoveryCount: readPositiveInt(process.env.AUTO_PROMOTION_NORMAL_RISING_COUNT, 2),
  },
  active: {
    minDiscoveryCount: readPositiveInt(process.env.AUTO_PROMOTION_ACTIVE_DISCOVERY_COUNT, 10),
    minRankingDiscoveryCount: readPositiveInt(
      process.env.AUTO_PROMOTION_ACTIVE_RANKING_COUNT,
      4,
    ),
    minRisingDiscoveryCount: readPositiveInt(process.env.AUTO_PROMOTION_ACTIVE_RISING_COUNT, 3),
  },
};

export const AUTO_RESTORE_MIN_DISCOVERY_COUNT = readPositiveInt(
  process.env.AUTO_RESTORE_MIN_DISCOVERY_COUNT,
  1,
);

export const AUTO_RESTORE_MIN_RANKING_DISCOVERY_COUNT = readPositiveInt(
  process.env.AUTO_RESTORE_MIN_RANKING_DISCOVERY_COUNT,
  1,
);

export const AUTO_WATCHLIST_CONFIG = {
  promotionLookbackMs: AUTO_WATCHLIST_PROMOTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  demotionLookbackMs: AUTO_WATCHLIST_DEMOTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  restoreLookbackMs: AUTO_WATCHLIST_RESTORE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  demotionInactiveUploadMs: readPositiveDays(
    process.env.AUTO_WATCHLIST_DEMOTION_INACTIVE_UPLOAD_DAYS,
    AUTO_WATCHLIST_DEMOTION_INACTIVE_UPLOAD_DAYS,
  ),
  restoreRecentUploadMs: readPositiveDays(
    process.env.AUTO_WATCHLIST_RESTORE_RECENT_UPLOAD_DAYS,
    AUTO_WATCHLIST_RESTORE_RECENT_UPLOAD_DAYS,
  ),
  promotionTierThresholds: AUTO_PROMOTION_TIER_THRESHOLDS,
  restoreMinDiscoveryCount: AUTO_RESTORE_MIN_DISCOVERY_COUNT,
  restoreMinRankingDiscoveryCount: AUTO_RESTORE_MIN_RANKING_DISCOVERY_COUNT,
  rankingSourceTypes: AUTO_WATCHLIST_RANKING_SOURCE_TYPES,
  performanceExcludedSourceTypes: AUTO_WATCHLIST_PERFORMANCE_EXCLUDED_SOURCE_TYPES,
  enrollmentSkipSourceTypes: AUTO_WATCHLIST_ENROLLMENT_SKIP_SOURCE_TYPES,
} as const;
