import {
  AUTO_WATCHLIST_CONFIG,
  type AUTO_WATCHLIST_RANKING_SOURCE_TYPES,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistConfig";
import type { DiscoverySourceType } from "@/types/observability";

export interface ChannelDiscoveryRecord {
  channelId: string;
  sourceType: DiscoverySourceType;
  videoId: string;
  discoveredAt: string;
  metadata: Record<string, unknown> | null;
}

export interface ChannelAutoWatchlistMetrics {
  channelId: string;
  performanceDiscoveryCount: number;
  rankingDiscoveryCount: number;
  risingDiscoveryCount: number;
  distinctPerformanceVideoCount: number;
  lastUploadAt: string | null;
}

const rankingSourceTypeSet = new Set<string>(
  AUTO_WATCHLIST_CONFIG.rankingSourceTypes satisfies readonly string[],
);

const performanceExcludedSourceTypeSet = new Set<string>(
  AUTO_WATCHLIST_CONFIG.performanceExcludedSourceTypes satisfies readonly string[],
);

function isRankingDiscoverySource(sourceType: DiscoverySourceType): boolean {
  return rankingSourceTypeSet.has(sourceType);
}

function isPerformanceDiscoverySource(sourceType: DiscoverySourceType): boolean {
  return !performanceExcludedSourceTypeSet.has(sourceType);
}

function isRisingDiscovery(metadata: Record<string, unknown> | null): boolean {
  if (!metadata) {
    return false;
  }

  if (metadata.hotCandidate === true) {
    return true;
  }

  const registrationPath =
    typeof metadata.registrationPath === "string" ? metadata.registrationPath : "";
  return registrationPath.includes("early_rise") || registrationPath.includes("rising");
}

export function aggregateChannelDiscoveryMetrics(
  channelId: string,
  discoveries: ChannelDiscoveryRecord[],
  lastUploadAt: string | null,
): ChannelAutoWatchlistMetrics {
  const performanceVideoIds = new Set<string>();
  let performanceDiscoveryCount = 0;
  let rankingDiscoveryCount = 0;
  let risingDiscoveryCount = 0;

  for (const discovery of discoveries) {
    if (!isPerformanceDiscoverySource(discovery.sourceType)) {
      continue;
    }

    performanceDiscoveryCount += 1;
    performanceVideoIds.add(discovery.videoId);

    if (isRankingDiscoverySource(discovery.sourceType)) {
      rankingDiscoveryCount += 1;
    }

    if (isRisingDiscovery(discovery.metadata)) {
      risingDiscoveryCount += 1;
    }
  }

  return {
    channelId,
    performanceDiscoveryCount,
    rankingDiscoveryCount,
    risingDiscoveryCount,
    distinctPerformanceVideoCount: performanceVideoIds.size,
    lastUploadAt,
  };
}

export function createEmptyChannelMetrics(
  channelId: string,
  lastUploadAt: string | null = null,
): ChannelAutoWatchlistMetrics {
  return aggregateChannelDiscoveryMetrics(channelId, [], lastUploadAt);
}

export type { AUTO_WATCHLIST_RANKING_SOURCE_TYPES };
