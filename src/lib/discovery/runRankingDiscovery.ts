import { registerBuzzCandidatesFromYouTubeItems } from "@/lib/discovery/buzzCandidateRegistration";
import {
  finishDiscoveryRun,
  findRecentRunningDiscoveryRun,
  startDiscoveryRun,
} from "@/lib/discovery/runsRepository";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import { estimateRankingDiscoveryQuotaUnits } from "@/lib/observability/quotaEstimates";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getRankingDiscoveryVideoItems } from "@/lib/youtube/rankings";

export interface RankingDiscoveryResult {
  runId: string;
  status: "success" | "partial" | "failed";
  candidatesFetched: number;
  candidatesProcessed: number;
  videosInserted: number;
  videosUpdated: number;
  discoveriesInserted: number;
  discoveriesDuplicate: number;
  schedulesCreated: number;
  schedulesExisting: number;
  candidatesSkipped: number;
  failures: number;
  youtubeQuotaEstimate: number;
  errors: string[];
}

export interface RankingDiscoveryDeps {
  findRunningRun: typeof findRecentRunningDiscoveryRun;
  startRun: typeof startDiscoveryRun;
  finishRun: typeof finishDiscoveryRun;
  fetchCandidates: typeof getRankingDiscoveryVideoItems;
  registerCandidates: typeof registerBuzzCandidatesFromYouTubeItems;
}

const defaultDeps: RankingDiscoveryDeps = {
  findRunningRun: findRecentRunningDiscoveryRun,
  startRun: startDiscoveryRun,
  finishRun: finishDiscoveryRun,
  fetchCandidates: getRankingDiscoveryVideoItems,
  registerCandidates: registerBuzzCandidatesFromYouTubeItems,
};

export async function runRankingDiscovery(
  deps: RankingDiscoveryDeps = defaultDeps,
): Promise<RankingDiscoveryResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const running = await deps.findRunningRun();
  if (running) {
    throw new Error("Discovery is already in progress.");
  }

  const runId = await deps.startRun("ranking_generation");
  const errors: string[] = [];

  try {
    const items = await deps.fetchCandidates(
      OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert,
    );
    const registration = await deps.registerCandidates(items, {
      period: OBSERVABILITY_CONFIG.defaults.rankingPeriod,
      genre: OBSERVABILITY_CONFIG.defaults.genre,
    });

    const status =
      registration.failures > 0
        ? registration.candidatesProcessed > 0
          ? "partial"
          : "failed"
        : "success";

    const youtubeQuotaEstimate = estimateRankingDiscoveryQuotaUnits({
      videoCount: items.length,
      channelCount: new Set(items.map((item) => item.snippet.channelId)).size,
      searchCalls: OBSERVABILITY_CONFIG.rankingDiscovery.searchCallsPerRun,
    });

    await deps.finishRun(runId, {
      status,
      itemsProcessed: registration.candidatesProcessed,
      itemsDiscovered: registration.discoveriesInserted,
      itemsFailed: registration.failures,
      youtubeQuotaEstimate,
      errorSummary: errors.length > 0 ? errors.join(" | ") : null,
      metadata: {
        candidatesFetched: items.length,
        videosInserted: registration.videosInserted,
        videosUpdated: registration.videosUpdated,
        schedulesCreated: registration.schedulesCreated,
        schedulesExisting: registration.schedulesExisting,
        discoveriesDuplicate: registration.discoveriesDuplicate,
        candidatesSkipped: registration.candidatesSkipped,
      },
    });

    return {
      runId,
      status,
      candidatesFetched: items.length,
      candidatesProcessed: registration.candidatesProcessed,
      videosInserted: registration.videosInserted,
      videosUpdated: registration.videosUpdated,
      discoveriesInserted: registration.discoveriesInserted,
      discoveriesDuplicate: registration.discoveriesDuplicate,
      schedulesCreated: registration.schedulesCreated,
      schedulesExisting: registration.schedulesExisting,
      candidatesSkipped: registration.candidatesSkipped,
      failures: registration.failures,
      youtubeQuotaEstimate,
      errors,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ranking discovery failed.";

    await deps.finishRun(runId, {
      status: "failed",
      itemsProcessed: 0,
      itemsDiscovered: 0,
      itemsFailed: 1,
      youtubeQuotaEstimate: estimateRankingDiscoveryQuotaUnits({
        videoCount: 0,
        channelCount: 0,
        searchCalls: OBSERVABILITY_CONFIG.rankingDiscovery.searchCallsPerRun,
      }),
      errorSummary: message,
      metadata: null,
    });

    throw error;
  }
}
