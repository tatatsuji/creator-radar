import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import type { WatchlistDiscoveryResult } from "@/lib/discovery/runWatchlistDiscovery";
import { runQuotaGatedOperation } from "@/lib/quota/quotaGatedCron";
import { estimateWatchlistDiscoveryQuotaForCron } from "@/lib/quota/quotaOperationEstimates";

export interface WatchlistDiscoveryCronResult {
  watchlist: WatchlistDiscoveryResult | null;
  collectedAt: string;
  quotaStatus: "executed" | "deferred" | "skipped";
  quotaReason: string;
}

export async function runWatchlistDiscoveryCron(): Promise<WatchlistDiscoveryCronResult> {
  const gated = await runQuotaGatedOperation({
    operationType: "watchlist_discovery",
    estimateUnits: estimateWatchlistDiscoveryQuotaForCron,
    execute: runWatchlistDiscovery,
  });

  return {
    watchlist: gated.result ?? null,
    collectedAt: new Date().toISOString(),
    quotaStatus: gated.status,
    quotaReason: gated.authorization.reason,
  };
}
