import {
  buildCategorySearchSourceKey,
  buildMostPopularSourceKey,
  buildSearchSourceKey,
} from "@/lib/discovery/sourceKey";
import {
  registerBuzzCandidatesFromYouTubeItems,
  type RegisterBuzzCandidatesResult,
} from "@/lib/discovery/buzzCandidateRegistration";
import { registerDbRemeasureCandidates } from "@/lib/discovery/dbRemeasureDiscovery";
import {
  pickGenresForCategoryFetch,
  pickMostPopularFetches,
} from "@/lib/discovery/categoryStrategy";
import {
  finishDiscoveryRun,
  findRecentRunningDiscoveryRun,
  startDiscoveryRun,
} from "@/lib/discovery/runsRepository";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  estimateSearchQuotaUnits,
  estimateVideosListQuotaUnits,
  fetchCategoryDiscoveryItems,
  fetchLiveDiscoveryItems,
  fetchMostPopularVideoItems,
  fetchShortFormCandidateItems,
} from "@/lib/youtube/candidateFetch";
import { getRankingDiscoveryVideoItems } from "@/lib/youtube/rankings";
import { mergeVideoItems } from "@/lib/youtube/filters";
import { getYouTubeCategoryId } from "@/lib/youtube/categories";
import type { GenreId } from "@/types";
import type { DiscoverySourceType } from "@/types/observability";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

export interface CandidateDiscoverySourceReport {
  source: string;
  fetched: number;
  registered: RegisterBuzzCandidatesResult;
  quotaEstimate: number;
}

export interface CandidateDiscoveryEngineResult {
  runId: string;
  status: "success" | "partial" | "failed";
  totalFetched: number;
  totalRegistered: number;
  sources: CandidateDiscoverySourceReport[];
  dbRemeasure: Awaited<ReturnType<typeof registerDbRemeasureCandidates>>;
  youtubeQuotaEstimate: number;
  errors: string[];
}

function mergeResults(
  target: RegisterBuzzCandidatesResult,
  source: RegisterBuzzCandidatesResult,
): void {
  target.candidatesProcessed += source.candidatesProcessed;
  target.candidatesSkipped += source.candidatesSkipped;
  target.videosInserted += source.videosInserted;
  target.videosUpdated += source.videosUpdated;
  target.discoveriesInserted += source.discoveriesInserted;
  target.discoveriesDuplicate += source.discoveriesDuplicate;
  target.schedulesCreated += source.schedulesCreated;
  target.schedulesExisting += source.schedulesExisting;
  target.failures += source.failures;
}

function emptyRegisterResult(): RegisterBuzzCandidatesResult {
  return {
    candidatesProcessed: 0,
    candidatesSkipped: 0,
    videosInserted: 0,
    videosUpdated: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    schedulesCreated: 0,
    schedulesExisting: 0,
    failures: 0,
  };
}

async function registerSourceBatch(input: {
  label: string;
  items: YouTubeVideoItem[];
  sourceType: DiscoverySourceType;
  sourceKey: string;
  period: "24h";
  genre: GenreId;
  quotaEstimate: number;
  limit?: number;
}): Promise<CandidateDiscoverySourceReport> {
  const registered = await registerBuzzCandidatesFromYouTubeItems(input.items, {
    period: input.period,
    genre: input.genre,
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
    limit: input.limit,
  });

  return {
    source: input.label,
    fetched: input.items.length,
    registered,
    quotaEstimate: input.quotaEstimate,
  };
}

export async function runCandidateDiscoveryEngine(
  runIndex = 0,
): Promise<CandidateDiscoveryEngineResult> {
  const running = await findRecentRunningDiscoveryRun();
  if (running) {
    throw new Error("Discovery is already in progress.");
  }

  const runId = await startDiscoveryRun("ranking_generation");
  const sources: CandidateDiscoverySourceReport[] = [];
  const errors: string[] = [];
  let youtubeQuotaEstimate = 0;
  let totalFetched = 0;
  const totalRegistered = emptyRegisterResult();

  try {
    for (const genre of pickGenresForCategoryFetch(runIndex)) {
      try {
        const items = await fetchCategoryDiscoveryItems({
          genre,
          period: "24h",
          maxResultsPerSource:
            OBSERVABILITY_CONFIG.phase1Discovery.maxResultsPerCategorySource,
        });
        totalFetched += items.length;
        const report = await registerSourceBatch({
          label: `category:${genre}`,
          items,
          sourceType: "category_search",
          sourceKey: buildCategorySearchSourceKey(
            getYouTubeCategoryId(genre) ?? "0",
            `phase1:${genre}:24h`,
          ),
          period: "24h",
          genre,
          quotaEstimate:
            estimateSearchQuotaUnits(2) +
            estimateVideosListQuotaUnits(items.length) +
            estimateVideosListQuotaUnits(items.length > 0 ? 1 : 0),
          limit: OBSERVABILITY_CONFIG.phase1Discovery.maxResultsPerCategorySource,
        });
        sources.push(report);
        youtubeQuotaEstimate += report.quotaEstimate;
        mergeResults(totalRegistered, report.registered);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `category:${genre}: ${error.message}`
            : `category:${genre}: failed`,
        );
      }
    }

    for (const [label, fetcher, sourceType, sourceKey, quotaCalls] of [
      [
        "short_form",
        () =>
          fetchShortFormCandidateItems(
            "24h",
            OBSERVABILITY_CONFIG.phase1Discovery.shortsMaxResults,
          ),
        "short_form_candidate" as const,
        buildSearchSourceKey("phase1:short_form:24h"),
        1,
      ],
      [
        "live",
        () =>
          fetchLiveDiscoveryItems(
            "24h",
            OBSERVABILITY_CONFIG.phase1Discovery.liveMaxResults,
          ),
        "live_search" as const,
        buildSearchSourceKey("phase1:live:24h"),
        2,
      ],
    ] as const) {
      try {
        const items = await fetcher();
        totalFetched += items.length;
        const report = await registerSourceBatch({
          label,
          items,
          sourceType,
          sourceKey,
          period: "24h",
          genre: "all",
          quotaEstimate:
            estimateSearchQuotaUnits(quotaCalls) +
            estimateVideosListQuotaUnits(items.length),
        });
        sources.push(report);
        youtubeQuotaEstimate += report.quotaEstimate;
        mergeResults(totalRegistered, report.registered);
      } catch (error) {
        errors.push(
          error instanceof Error ? `${label}: ${error.message}` : `${label}: failed`,
        );
      }
    }

    try {
      const rankingItems = await getRankingDiscoveryVideoItems(
        OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert,
      );
      totalFetched += rankingItems.length;
      const report = await registerSourceBatch({
        label: "ranking:24h+7d",
        items: rankingItems,
        sourceType: "search",
        sourceKey: buildSearchSourceKey("ranking:phase1:24h+7d"),
        period: "24h",
        genre: "all",
        quotaEstimate:
          estimateSearchQuotaUnits(
            OBSERVABILITY_CONFIG.rankingDiscovery.searchCallsPerRun *
              OBSERVABILITY_CONFIG.rankingDiscovery.periods.length,
          ) + estimateVideosListQuotaUnits(rankingItems.length),
        limit: OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert,
      });
      sources.push(report);
      youtubeQuotaEstimate += report.quotaEstimate;
      mergeResults(totalRegistered, report.registered);
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `ranking: ${error.message}`
          : "ranking: failed",
      );
    }

    try {
      const popularPlans = pickMostPopularFetches(runIndex);
      const popularBatches = await Promise.all(
        popularPlans.map((plan) =>
          fetchMostPopularVideoItems(plan.genre, plan.maxResults).catch(
            () => [] as YouTubeVideoItem[],
          ),
        ),
      );
      const popularItems = mergeVideoItems(...popularBatches);

      if (popularItems.length > 0) {
        totalFetched += popularItems.length;
        const report = await registerSourceBatch({
          label: "most_popular:tiered",
          items: popularItems,
          sourceType: "most_popular",
          sourceKey: buildMostPopularSourceKey("JP", "all"),
          period: "24h",
          genre: "all",
          quotaEstimate: estimateVideosListQuotaUnits(popularItems.length),
          limit: OBSERVABILITY_CONFIG.phase1Discovery.mostPopularRegisterLimit,
        });
        sources.push(report);
        youtubeQuotaEstimate += report.quotaEstimate;
        mergeResults(totalRegistered, report.registered);
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `most_popular: ${error.message}`
          : "most_popular: failed",
      );
    }

    const dbRemeasure = await registerDbRemeasureCandidates();

    const status =
      errors.length === 0
        ? "success"
        : totalRegistered.candidatesProcessed + dbRemeasure.candidatesProcessed > 0
          ? "partial"
          : "failed";

    await finishDiscoveryRun(runId, {
      status,
      itemsProcessed: totalRegistered.candidatesProcessed + dbRemeasure.candidatesProcessed,
      itemsDiscovered:
        totalRegistered.discoveriesInserted + dbRemeasure.discoveriesInserted,
      itemsFailed: totalRegistered.failures + dbRemeasure.failures,
      youtubeQuotaEstimate,
      errorSummary: errors.length > 0 ? errors.slice(0, 5).join(" | ") : null,
      metadata: {
        runIndex,
        sources: sources.map((source) => ({
          source: source.source,
          fetched: source.fetched,
          registered: source.registered.candidatesProcessed,
        })),
        dbRemeasure,
      },
    });

    return {
      runId,
      status,
      totalFetched,
      totalRegistered: totalRegistered.candidatesProcessed,
      sources,
      dbRemeasure,
      youtubeQuotaEstimate,
      errors,
    };
  } catch (error) {
    await finishDiscoveryRun(runId, {
      status: "failed",
      itemsProcessed: 0,
      itemsDiscovered: 0,
      itemsFailed: 1,
      youtubeQuotaEstimate,
      errorSummary:
        error instanceof Error ? error.message : "Candidate discovery failed",
      metadata: null,
    });
    throw error;
  }
}
