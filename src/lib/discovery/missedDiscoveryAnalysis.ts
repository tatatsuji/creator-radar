/**
 * Root-cause classification for videos in ground truth that Creator Radar missed.
 */
export type MissedDiscoveryCause =
  | "source_not_queried"
  | "category_not_rotated"
  | "most_popular_not_fetched"
  | "search_window_missed"
  | "pagination_limit"
  | "region_or_language_filter"
  | "duration_filter"
  | "shorts_misclassification"
  | "live_misclassification"
  | "dedupe_bug"
  | "db_upsert_failure"
  | "cron_not_executed"
  | "discovered_after_measurement"
  | "unavailable_or_deleted"
  | "unknown";

export type ImprovementCost = "low" | "medium" | "high";
export type QuotaImpact = "none" | "low" | "medium" | "high";

export interface MissedVideoAnalysisInput {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  publishedAt: string;
  categoryId?: string;
  durationSeconds?: number;
  liveBroadcastContent?: string;
  groundTruthSources: string[];
  /** Whether video appears in JP mostPopular all chart (API check). */
  inMostPopularAll: boolean;
  /** Whether video appears in its category mostPopular chart. */
  inMostPopularCategory: boolean;
  /** Whether video appears in 24h viewCount search. */
  inSearchViewCount24h: boolean;
  /** Whether video appears in 24h date search. */
  inSearchDate24h: boolean;
  /** Category genre that would cover this video. */
  mappedGenre: string | null;
  /** Was mapped genre in rotation at last discovery run? */
  genreWasInRotation: boolean;
  /** Video exists in Creator Radar DB. */
  inDb: boolean;
  /** Video unavailable on YouTube. */
  unavailable: boolean;
  /** Hours since publish at analysis time. */
  ageHours: number;
}

export interface MissedVideoAnalysisResult {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string;
  categoryId?: string;
  durationSeconds?: number;
  liveBroadcastContent?: string;
  groundTruthSources: string[];
  cause: MissedDiscoveryCause;
  causeDetail: string;
  expectedSource: string;
  improvable: boolean;
  improvementCost: ImprovementCost;
  quotaImpact: QuotaImpact;
}

export interface MissedDiscoveryAnalysisSummary {
  analyzedAt: string;
  totalMissed: number;
  byCause: Record<string, number>;
  byCausePercent: Record<string, number>;
  improvableCount: number;
  expectedRecallAfterFix: number;
  improvableWithoutQuotaIncrease: number;
  requiresQuotaIncrease: number;
  videos: MissedVideoAnalysisResult[];
}

const GENRE_TO_CATEGORY: Record<string, string> = {
  "10": "music",
  "17": "sports",
  "20": "game",
  "24": "entertainment",
  "25": "news",
  "26": "howto",
};

export function mapCategoryIdToGenre(categoryId?: string): string | null {
  if (!categoryId) {
    return null;
  }
  return GENRE_TO_CATEGORY[categoryId] ?? null;
}

export function classifyMissedVideo(
  input: MissedVideoAnalysisInput,
): MissedVideoAnalysisResult {
  if (input.unavailable) {
    return buildResult(input, "unavailable_or_deleted", "Video not available on YouTube API", "none", false, "low", "none");
  }

  const gtFromPopular = input.groundTruthSources.some((source) =>
    source.startsWith("most_popular:"),
  );

  if (gtFromPopular && !input.inMostPopularAll && !input.inMostPopularCategory) {
    if (input.ageHours > 168) {
      return buildResult(
        input,
        "search_window_missed",
        "Video aged out of mostPopular chart window",
        "most_popular",
        false,
        "low",
        "none",
      );
    }
  }

  if (gtFromPopular && (input.inMostPopularAll || input.inMostPopularCategory)) {
    if (!input.genreWasInRotation && input.mappedGenre) {
      return buildResult(
        input,
        "category_not_rotated",
        `Category ${input.mappedGenre} was not in this run's rotation`,
        "most_popular",
        true,
        "low",
        "low",
      );
    }
    return buildResult(
      input,
      "most_popular_not_fetched",
      "Video is on mostPopular chart but Creator Radar did not fetch/register it (limit or prior cron gap)",
      "most_popular",
      true,
      "medium",
      "low",
    );
  }

  if (
    input.groundTruthSources.some((source) => source.startsWith("search:")) &&
    !input.inSearchViewCount24h &&
    !input.inSearchDate24h
  ) {
    return buildResult(
      input,
      "search_window_missed",
      "Video not returned by current search queries",
      "search",
      true,
      "medium",
      "medium",
    );
  }

  if (
    input.groundTruthSources.some((source) => source.startsWith("category:")) &&
    input.mappedGenre &&
    !input.genreWasInRotation
  ) {
    return buildResult(
      input,
      "category_not_rotated",
      `Category ${input.mappedGenre} not fetched this run`,
      "category_search",
      true,
      "low",
      "low",
    );
  }

  if (!input.inDb) {
    return buildResult(
      input,
      "source_not_queried",
      "No discovery source returned this video before measurement",
      input.mappedGenre ? `category_search:${input.mappedGenre}` : "most_popular",
      true,
      "medium",
      "medium",
    );
  }

  return buildResult(
    input,
    "unknown",
    "In DB but no discovery record matched ground truth window",
    "db_remeasure",
    false,
    "high",
    "none",
  );
}

function buildResult(
  input: MissedVideoAnalysisInput,
  cause: MissedDiscoveryCause,
  causeDetail: string,
  expectedSource: string,
  improvable: boolean,
  improvementCost: ImprovementCost,
  quotaImpact: QuotaImpact,
): MissedVideoAnalysisResult {
  return {
    videoId: input.videoId,
    title: input.title,
    channel: input.channelName,
    publishedAt: input.publishedAt,
    categoryId: input.categoryId,
    durationSeconds: input.durationSeconds,
    liveBroadcastContent: input.liveBroadcastContent,
    groundTruthSources: input.groundTruthSources,
    cause,
    causeDetail,
    expectedSource,
    improvable,
    improvementCost,
    quotaImpact,
  };
}

export function summarizeMissedAnalysis(
  videos: MissedVideoAnalysisResult[],
  groundTruthCount: number,
  currentDiscoveredCount: number,
): MissedDiscoveryAnalysisSummary {
  const byCause: Record<string, number> = {};
  let improvableCount = 0;
  let improvableWithoutQuotaIncrease = 0;
  let requiresQuotaIncrease = 0;

  for (const video of videos) {
    byCause[video.cause] = (byCause[video.cause] ?? 0) + 1;
    if (video.improvable) {
      improvableCount += 1;
      if (video.quotaImpact === "none" || video.quotaImpact === "low") {
        improvableWithoutQuotaIncrease += 1;
      } else {
        requiresQuotaIncrease += 1;
      }
    }
  }

  const byCausePercent: Record<string, number> = {};
  for (const [cause, count] of Object.entries(byCause)) {
    byCausePercent[cause] =
      videos.length > 0 ? Math.round((count / videos.length) * 1000) / 10 : 0;
  }

  const expectedAdditionalRecall = improvableCount / Math.max(1, groundTruthCount);

  return {
    analyzedAt: new Date().toISOString(),
    totalMissed: videos.length,
    byCause,
    byCausePercent,
    improvableCount,
    expectedRecallAfterFix: Math.min(
      1,
      currentDiscoveredCount / Math.max(1, groundTruthCount) + expectedAdditionalRecall,
    ),
    improvableWithoutQuotaIncrease,
    requiresQuotaIncrease,
    videos,
  };
}
