import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  estimateSearchQuotaUnits,
  estimateVideosListQuotaUnits,
} from "@/lib/youtube/candidateFetch";
import {
  pickGenresForCategoryFetch,
  pickMostPopularFetches,
} from "@/lib/discovery/categoryStrategy";

export const YOUTUBE_DAILY_QUOTA_UNITS = 10_000;
export const QUOTA_TARGET_USAGE_RATIO = 0.7;
export const QUOTA_RESERVE_RATIO = 0.3;

export interface SourceQuotaEstimate {
  source: string;
  unitsPerRun: number;
  unitsPerDay: number;
}

export function estimateDiscoveryQuotaPerRun(runIndex = 0): {
  sources: SourceQuotaEstimate[];
  totalPerRun: number;
  totalPerDay: number;
  withinDailyTarget: boolean;
  dailyTargetUnits: number;
} {
  const runsPerDay = OBSERVABILITY_CONFIG.phase1Discovery.categoryStrategy.runsPerDay;
  const categoryGenres = pickGenresForCategoryFetch(runIndex);
  const popularPlans = pickMostPopularFetches(runIndex);

  const categoryUnits = categoryGenres.reduce((sum) => {
    const searchUnits = estimateSearchQuotaUnits(2);
    const listUnits = estimateVideosListQuotaUnits(50) + 1;
    return sum + searchUnits + listUnits;
  }, 0);

  const popularUnits = popularPlans.reduce(
    (sum, plan) => sum + estimateVideosListQuotaUnits(plan.maxResults),
    0,
  );

  const shortsUnits =
    estimateSearchQuotaUnits(1) +
    estimateVideosListQuotaUnits(
      OBSERVABILITY_CONFIG.phase1Discovery.shortsMaxResults,
    );

  const liveUnits =
    estimateSearchQuotaUnits(2) +
    estimateVideosListQuotaUnits(
      OBSERVABILITY_CONFIG.phase1Discovery.liveMaxResults,
    );

  const rankingUnits =
    estimateSearchQuotaUnits(
      OBSERVABILITY_CONFIG.rankingDiscovery.searchCallsPerRun *
        OBSERVABILITY_CONFIG.rankingDiscovery.periods.length,
    ) + estimateVideosListQuotaUnits(OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert);

  const watchlistUnits = OBSERVABILITY_CONFIG.batchSize.watchlistCheck * 3;

  const sources: SourceQuotaEstimate[] = [
    { source: "category_search", unitsPerRun: categoryUnits, unitsPerDay: categoryUnits * runsPerDay },
    { source: "most_popular", unitsPerRun: popularUnits, unitsPerDay: popularUnits * runsPerDay },
    { source: "short_form_candidate", unitsPerRun: shortsUnits, unitsPerDay: shortsUnits * runsPerDay },
    { source: "live_search", unitsPerRun: liveUnits, unitsPerDay: liveUnits * runsPerDay },
    { source: "search", unitsPerRun: rankingUnits, unitsPerDay: rankingUnits * runsPerDay },
    { source: "watchlist_upload", unitsPerRun: watchlistUnits, unitsPerDay: watchlistUnits * runsPerDay },
    { source: "db_remeasure", unitsPerRun: 0, unitsPerDay: 0 },
  ];

  const totalPerRun = sources.reduce((sum, row) => sum + row.unitsPerRun, 0);
  const totalPerDay = sources.reduce((sum, row) => sum + row.unitsPerDay, 0);
  const dailyTargetUnits = YOUTUBE_DAILY_QUOTA_UNITS * QUOTA_TARGET_USAGE_RATIO;

  return {
    sources,
    totalPerRun,
    totalPerDay,
    withinDailyTarget: totalPerDay <= dailyTargetUnits,
    dailyTargetUnits,
  };
}
