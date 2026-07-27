import { runRankingDiscovery } from "@/lib/discovery/runRankingDiscovery";
import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import type { RankingDiscoveryResult } from "@/lib/discovery/runRankingDiscovery";
import type { WatchlistDiscoveryResult } from "@/lib/discovery/runWatchlistDiscovery";

export interface DiscoveryCronResult {
  watchlist: WatchlistDiscoveryResult;
  ranking: RankingDiscoveryResult | null;
  rankingError: string | null;
  collectedAt: string;
}

export async function runDiscoveryCron(): Promise<DiscoveryCronResult> {
  const watchlist = await runWatchlistDiscovery();

  let ranking: RankingDiscoveryResult | null = null;
  let rankingError: string | null = null;

  try {
    ranking = await runRankingDiscovery();
  } catch (error) {
    rankingError =
      error instanceof Error ? error.message : "Ranking discovery failed.";
  }

  return {
    watchlist,
    ranking,
    rankingError,
    collectedAt: new Date().toISOString(),
  };
}
