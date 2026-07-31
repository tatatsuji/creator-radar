import {
  AUTO_WATCHLIST_CONFIG,
  type AUTO_PROMOTION_TIER_THRESHOLDS,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistConfig";
import type { ChannelAutoWatchlistMetrics } from "@/lib/watchlist/autoWatchlist/autoWatchlistMetrics";
import {
  getHigherWatchTier,
  getLowerWatchTier,
  type PromotableWatchTier,
} from "@/lib/watchlist/autoWatchlist/watchTierOrder";
import type { WatchTier } from "@/types/observability";

export type AutoWatchlistTierAction = "PROMOTE" | "DEMOTE" | "RESTORE" | "ENROLL";

export interface AutoWatchlistTierDecision {
  action: AutoWatchlistTierAction;
  nextTier: WatchTier;
  reason: string;
}

function meetsPromotionThresholds(
  metrics: ChannelAutoWatchlistMetrics,
  thresholds: (typeof AUTO_PROMOTION_TIER_THRESHOLDS)[PromotableWatchTier],
): boolean {
  return (
    metrics.performanceDiscoveryCount >= thresholds.minDiscoveryCount ||
    metrics.rankingDiscoveryCount >= thresholds.minRankingDiscoveryCount ||
    metrics.risingDiscoveryCount >= thresholds.minRisingDiscoveryCount
  );
}

function isUploadInactive(
  metrics: ChannelAutoWatchlistMetrics,
  nowMs: number,
  inactiveUploadMs: number,
): boolean {
  if (!metrics.lastUploadAt) {
    return true;
  }

  return nowMs - new Date(metrics.lastUploadAt).getTime() > inactiveUploadMs;
}

function hasRecentUpload(
  metrics: ChannelAutoWatchlistMetrics,
  nowMs: number,
  recentUploadMs: number,
): boolean {
  if (!metrics.lastUploadAt) {
    return false;
  }

  return nowMs - new Date(metrics.lastUploadAt).getTime() <= recentUploadMs;
}

export function evaluateWatchlistPromotion(
  currentTier: WatchTier,
  metrics: ChannelAutoWatchlistMetrics,
  config: typeof AUTO_WATCHLIST_CONFIG = AUTO_WATCHLIST_CONFIG,
): AutoWatchlistTierDecision | null {
  if (currentTier === "hot" || currentTier === "archive") {
    return null;
  }

  const thresholds = config.promotionTierThresholds[currentTier as PromotableWatchTier];
  if (!meetsPromotionThresholds(metrics, thresholds)) {
    return null;
  }

  const nextTier = getHigherWatchTier(currentTier);
  if (!nextTier) {
    return null;
  }

  return {
    action: "PROMOTE",
    nextTier,
    reason: [
      `performanceDiscoveryCount=${metrics.performanceDiscoveryCount}`,
      `rankingDiscoveryCount=${metrics.rankingDiscoveryCount}`,
      `risingDiscoveryCount=${metrics.risingDiscoveryCount}`,
    ].join(", "),
  };
}

export function evaluateWatchlistDemotion(
  currentTier: WatchTier,
  metrics: ChannelAutoWatchlistMetrics,
  nowMs: number = Date.now(),
  config: typeof AUTO_WATCHLIST_CONFIG = AUTO_WATCHLIST_CONFIG,
): AutoWatchlistTierDecision | null {
  if (currentTier === "archive") {
    return null;
  }

  const uploadInactive = isUploadInactive(
    metrics,
    nowMs,
    config.demotionInactiveUploadMs,
  );
  const noPerformanceDiscoveries = metrics.performanceDiscoveryCount === 0;
  const noRankingDiscoveries = metrics.rankingDiscoveryCount === 0;

  if (!uploadInactive || !noPerformanceDiscoveries || !noRankingDiscoveries) {
    return null;
  }

  const nextTier = getLowerWatchTier(currentTier);
  if (!nextTier) {
    return null;
  }

  return {
    action: "DEMOTE",
    nextTier,
    reason: [
      "uploadInactive=true",
      "performanceDiscoveryCount=0",
      "rankingDiscoveryCount=0",
    ].join(", "),
  };
}

export function evaluateWatchlistRestore(
  currentTier: WatchTier,
  metrics: ChannelAutoWatchlistMetrics,
  nowMs: number = Date.now(),
  config: typeof AUTO_WATCHLIST_CONFIG = AUTO_WATCHLIST_CONFIG,
): AutoWatchlistTierDecision | null {
  if (currentTier !== "archive") {
    return null;
  }

  const recentUpload = hasRecentUpload(metrics, nowMs, config.restoreRecentUploadMs);
  const hasDiscovery =
    metrics.performanceDiscoveryCount >= config.restoreMinDiscoveryCount;
  const hasRanking =
    metrics.rankingDiscoveryCount >= config.restoreMinRankingDiscoveryCount;

  if (!recentUpload && !hasDiscovery && !hasRanking) {
    return null;
  }

  return {
    action: "RESTORE",
    nextTier: "cold",
    reason: [
      `recentUpload=${recentUpload}`,
      `performanceDiscoveryCount=${metrics.performanceDiscoveryCount}`,
      `rankingDiscoveryCount=${metrics.rankingDiscoveryCount}`,
    ].join(", "),
  };
}

export function evaluateAutoWatchlistTierChange(
  currentTier: WatchTier,
  metrics: ChannelAutoWatchlistMetrics,
  nowMs: number = Date.now(),
  config: typeof AUTO_WATCHLIST_CONFIG = AUTO_WATCHLIST_CONFIG,
): AutoWatchlistTierDecision | null {
  if (currentTier === "archive") {
    return evaluateWatchlistRestore(currentTier, metrics, nowMs, config);
  }

  const promotion = evaluateWatchlistPromotion(currentTier, metrics, config);
  if (promotion) {
    return promotion;
  }

  return evaluateWatchlistDemotion(currentTier, metrics, nowMs, config);
}
