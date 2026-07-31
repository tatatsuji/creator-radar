import type { AutoWatchlistTierAction } from "@/lib/watchlist/autoWatchlist/autoWatchlistTierEvaluation";
import type { WatchTier } from "@/types/observability";

export interface AutoWatchlistTierChangeLog {
  action: AutoWatchlistTierAction;
  channelId: string;
  previousTier?: WatchTier;
  nextTier: WatchTier;
  reason: string;
  timestamp: string;
}

export function logAutoWatchlistTierChange(
  entry: Omit<AutoWatchlistTierChangeLog, "timestamp">,
): void {
  const payload: AutoWatchlistTierChangeLog = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  console.info(`[AutoWatchlist:${entry.action}] ${JSON.stringify(payload)}`);
}
