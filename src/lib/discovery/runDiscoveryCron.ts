import { runCandidateDiscoveryEngine } from "@/lib/discovery/candidateDiscoveryEngine";
import type { CandidateDiscoveryEngineResult } from "@/lib/discovery/candidateDiscoveryEngine";
import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import type { WatchlistDiscoveryResult } from "@/lib/discovery/runWatchlistDiscovery";

export interface DiscoveryCronResult {
  watchlist: WatchlistDiscoveryResult;
  candidateDiscovery: CandidateDiscoveryEngineResult | null;
  candidateDiscoveryError: string | null;
  collectedAt: string;
}

function discoveryRunIndex(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

export async function runDiscoveryCron(): Promise<DiscoveryCronResult> {
  const watchlist = await runWatchlistDiscovery();

  let candidateDiscovery: CandidateDiscoveryEngineResult | null = null;
  let candidateDiscoveryError: string | null = null;

  try {
    candidateDiscovery = await runCandidateDiscoveryEngine(discoveryRunIndex());
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
