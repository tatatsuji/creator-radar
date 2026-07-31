import { runAutoWatchlist } from "@/lib/watchlist/autoWatchlist/runAutoWatchlist";
import type { AutoWatchlistResult } from "@/lib/watchlist/autoWatchlist/runAutoWatchlist";
import { runQuotaGatedOperation } from "@/lib/quota/quotaGatedCron";

export interface AutoWatchlistCronResult extends AutoWatchlistResult {
  quotaStatus: "executed" | "deferred" | "skipped";
  quotaReason: string;
}

export async function runAutoWatchlistCron(): Promise<AutoWatchlistCronResult> {
  const gated = await runQuotaGatedOperation({
    operationType: "auto_watchlist",
    estimateUnits: async () => 0,
    execute: runAutoWatchlist,
  });

  const result = gated.result ?? {
    runId: "",
    status: "failed" as const,
    channelsEvaluated: 0,
    promoted: 0,
    demoted: 0,
    restored: 0,
    unchanged: 0,
    errors: [],
  };

  return {
    ...result,
    quotaStatus: gated.status,
    quotaReason: gated.authorization.reason,
  };
}
