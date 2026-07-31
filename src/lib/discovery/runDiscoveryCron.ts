import { runCandidateDiscoveryEngine } from "@/lib/discovery/candidateDiscoveryEngine";
import type { CandidateDiscoveryEngineResult } from "@/lib/discovery/candidateDiscoveryEngine";
import { discoveryRunIndex } from "@/lib/discovery/categoryStrategy";
import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import type { WatchlistDiscoveryResult } from "@/lib/discovery/runWatchlistDiscovery";

export interface DiscoveryCronResult {
  watchlist: WatchlistDiscoveryResult;
  candidateDiscovery: CandidateDiscoveryEngineResult | null;
  candidateDiscoveryError: string | null;
  collectedAt: string;
}

function discoveryRunIndexForCron(): number {
  return discoveryRunIndex();
}

function failedWatchlistResult(message: string): WatchlistDiscoveryResult {
  return {
    runId: "",
    status: "failed",
    channelsDue: 0,
    channelsProcessed: 0,
    channelsFailed: 0,
    channelsSkippedWebsubHealthy: 0,
    channelsSafetyPoll: 0,
    channelsNormalPoll: 0,
    videosDiscovered: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    youtubeQuotaEstimate: 0,
    errors: [message],
  };
}

export async function runDiscoveryCron(): Promise<DiscoveryCronResult> {
  let watchlist: WatchlistDiscoveryResult;

  try {
    watchlist = await runWatchlistDiscovery();
  } catch (error) {
    watchlist = failedWatchlistResult(
      error instanceof Error ? error.message : "Watchlist discovery failed.",
    );
  }

  let candidateDiscovery: CandidateDiscoveryEngineResult | null = null;
  let candidateDiscoveryError: string | null = null;

  try {
    candidateDiscovery = await runCandidateDiscoveryEngine(discoveryRunIndexForCron());
  } catch (error) {
    candidateDiscoveryError =
      error instanceof Error ? error.message : "Candidate discovery failed.";
  }

  return {
    watchlist,
    candidateDiscovery,
    candidateDiscoveryError,
    collectedAt: new Date().toISOString(),
  };
}
