import {
  AUTO_WATCHLIST_CONFIG,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistConfig";
import { logAutoWatchlistTierChange } from "@/lib/watchlist/autoWatchlist/autoWatchlistLogger";
import {
  aggregateChannelDiscoveryMetrics,
  type ChannelDiscoveryRecord,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistMetrics";
import {
  evaluateWatchlistRestore,
  type AutoWatchlistTierDecision,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistTierEvaluation";
import { determineInitialWatchTier } from "@/lib/watchlist/watchTier";
import {
  getWatchlistChannelById,
  insertWatchlistChannelIfAbsent,
  updateWatchlistTierAndStatus,
} from "@/lib/watchlist/repository";
import type { DiscoverySourceType, WatchStatus, WatchTier } from "@/types/observability";

export interface AutoEnrollDiscoveredChannelInput {
  channelId: string;
  channelName?: string | null;
  sourceType: DiscoverySourceType;
  subscriberCount?: number | null;
  category?: string | null;
}

export interface RestoreArchiveOnDiscoveryInput {
  channelId: string;
  sourceType: DiscoverySourceType;
  discoveryInserted: boolean;
  discoveredAt?: string;
  lastUploadAt?: string | null;
}

function shouldSkipAutoEnrollment(sourceType: DiscoverySourceType): boolean {
  return AUTO_WATCHLIST_CONFIG.enrollmentSkipSourceTypes.includes(
    sourceType as (typeof AUTO_WATCHLIST_CONFIG.enrollmentSkipSourceTypes)[number],
  );
}

function isPerformanceDiscoverySource(sourceType: DiscoverySourceType): boolean {
  return !AUTO_WATCHLIST_CONFIG.performanceExcludedSourceTypes.includes(
    sourceType as (typeof AUTO_WATCHLIST_CONFIG.performanceExcludedSourceTypes)[number],
  );
}

export async function autoEnrollDiscoveredChannel(
  input: AutoEnrollDiscoveredChannelInput,
): Promise<"enrolled" | "skipped" | "exists"> {
  if (shouldSkipAutoEnrollment(input.sourceType)) {
    return "skipped";
  }

  const initialTier = determineInitialWatchTier(input.subscriberCount ?? null);
  const result = await insertWatchlistChannelIfAbsent({
    channelId: input.channelId,
    name: input.channelName ?? null,
    category: input.category ?? null,
    source: "auto_watchlist",
    watchTier: initialTier,
    watchStatus: "discovered",
    subscriberCount: input.subscriberCount ?? null,
  });

  if (result === "inserted") {
    logAutoWatchlistTierChange({
      action: "ENROLL",
      channelId: input.channelId,
      nextTier: initialTier,
      reason: `auto_enroll:sourceType=${input.sourceType}`,
    });
  }

  return result === "inserted" ? "enrolled" : "exists";
}

export async function applyAutoWatchlistTierDecision(
  channelId: string,
  currentTier: WatchTier,
  currentStatus: WatchStatus,
  decision: AutoWatchlistTierDecision,
): Promise<void> {
  if (decision.nextTier === currentTier) {
    return;
  }

  logAutoWatchlistTierChange({
    action: decision.action,
    channelId,
    previousTier: currentTier,
    nextTier: decision.nextTier,
    reason: decision.reason,
  });

  const nextStatus: WatchStatus =
    decision.action === "RESTORE" || currentStatus === "seed"
      ? "active"
      : currentStatus;

  await updateWatchlistTierAndStatus(channelId, decision.nextTier, nextStatus);
}

export async function restoreArchiveChannelOnDiscovery(
  input: RestoreArchiveOnDiscoveryInput,
): Promise<boolean> {
  if (!input.discoveryInserted || shouldSkipAutoEnrollment(input.sourceType)) {
    return false;
  }

  const watchlistRow = await getWatchlistChannelById(input.channelId);
  if (!watchlistRow || watchlistRow.watch_tier !== "archive") {
    return false;
  }

  const sinceMs = Date.now() - AUTO_WATCHLIST_CONFIG.restoreLookbackMs;
  const discoveredAt = input.discoveredAt ?? new Date().toISOString();
  if (new Date(discoveredAt).getTime() < sinceMs) {
    return false;
  }

  const discoveryRecord: ChannelDiscoveryRecord | null = isPerformanceDiscoverySource(
    input.sourceType,
  )
    ? {
        channelId: input.channelId,
        sourceType: input.sourceType,
        videoId: "discovery-event",
        discoveredAt,
        metadata: null,
      }
    : null;

  const metrics = aggregateChannelDiscoveryMetrics(
    input.channelId,
    discoveryRecord ? [discoveryRecord] : [],
    input.lastUploadAt ?? null,
  );

  const decision = evaluateWatchlistRestore(
    watchlistRow.watch_tier as WatchTier,
    metrics,
  );
  if (!decision) {
    return false;
  }

  await applyAutoWatchlistTierDecision(
    input.channelId,
    watchlistRow.watch_tier as WatchTier,
    watchlistRow.watch_status as WatchStatus,
    decision,
  );
  return true;
}
