import {
  finishDiscoveryRun,
  findRecentRunningDiscoveryRun,
  startDiscoveryRun,
} from "@/lib/discovery/runsRepository";
import { AUTO_WATCHLIST_CONFIG } from "@/lib/watchlist/autoWatchlist/autoWatchlistConfig";
import {
  applyAutoWatchlistTierDecision,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistEnrollment";
import { loadAutoWatchlistMetricsForChannels } from "@/lib/watchlist/autoWatchlist/autoWatchlistMetricsRepository";
import { evaluateAutoWatchlistTierChange } from "@/lib/watchlist/autoWatchlist/autoWatchlistTierEvaluation";
import { listWatchlistChannels } from "@/lib/watchlist/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { WatchStatus, WatchTier } from "@/types/observability";
import { isWatchStatus, isWatchTier } from "@/types/observability";

export interface AutoWatchlistResult {
  runId: string;
  status: "success" | "partial" | "failed";
  channelsEvaluated: number;
  promoted: number;
  demoted: number;
  restored: number;
  unchanged: number;
  errors: string[];
}

export interface RunAutoWatchlistDeps {
  findRunningRun: typeof findRecentRunningDiscoveryRun;
  startRun: typeof startDiscoveryRun;
  finishRun: typeof finishDiscoveryRun;
  listChannels: typeof listWatchlistChannels;
  loadMetrics: typeof loadAutoWatchlistMetricsForChannels;
  applyDecision: typeof applyAutoWatchlistTierDecision;
}

const defaultDeps: RunAutoWatchlistDeps = {
  findRunningRun: findRecentRunningDiscoveryRun,
  startRun: startDiscoveryRun,
  finishRun: finishDiscoveryRun,
  listChannels: listWatchlistChannels,
  loadMetrics: loadAutoWatchlistMetricsForChannels,
  applyDecision: applyAutoWatchlistTierDecision,
};

export async function runAutoWatchlist(
  deps: RunAutoWatchlistDeps = defaultDeps,
  nowMs: number = Date.now(),
): Promise<AutoWatchlistResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const running = await deps.findRunningRun();
  if (running) {
    throw new Error("Discovery is already in progress.");
  }

  const runId = await deps.startRun("promotion_batch");
  const errors: string[] = [];
  let promoted = 0;
  let demoted = 0;
  let restored = 0;
  let unchanged = 0;

  try {
    const channels = await deps.listChannels();
    const channelIds = channels.map((channel) => channel.channel_id);
    const lookbackMs = Math.max(
      AUTO_WATCHLIST_CONFIG.promotionLookbackMs,
      AUTO_WATCHLIST_CONFIG.demotionLookbackMs,
      AUTO_WATCHLIST_CONFIG.restoreLookbackMs,
    );
    const sinceIso = new Date(nowMs - lookbackMs).toISOString();
    const metricsByChannel = await deps.loadMetrics(channelIds, sinceIso);

    for (const channel of channels) {
      try {
        const currentTier = isWatchTier(channel.watch_tier)
          ? channel.watch_tier
          : "normal";
        const currentStatus = isWatchStatus(channel.watch_status)
          ? channel.watch_status
          : "seed";
        const metrics =
          metricsByChannel.get(channel.channel_id) ??
          ({
            channelId: channel.channel_id,
            performanceDiscoveryCount: 0,
            rankingDiscoveryCount: 0,
            risingDiscoveryCount: 0,
            distinctPerformanceVideoCount: 0,
            lastUploadAt: null,
          } as const);

        const decision = evaluateAutoWatchlistTierChange(
          currentTier,
          metrics,
          nowMs,
        );

        if (!decision) {
          unchanged += 1;
          continue;
        }

        await deps.applyDecision(
          channel.channel_id,
          currentTier,
          currentStatus,
          decision,
        );

        if (decision.action === "PROMOTE") {
          promoted += 1;
        } else if (decision.action === "DEMOTE") {
          demoted += 1;
        } else if (decision.action === "RESTORE") {
          restored += 1;
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `${channel.channel_id}: ${error.message}`
            : `${channel.channel_id}: auto watchlist evaluation failed`,
        );
      }
    }

    const status =
      errors.length === 0
        ? "success"
        : promoted + demoted + restored > 0
          ? "partial"
          : "failed";

    await deps.finishRun(runId, {
      status,
      itemsProcessed: channels.length,
      itemsDiscovered: promoted + restored,
      itemsFailed: errors.length,
      youtubeQuotaEstimate: 0,
      errorSummary: errors.length > 0 ? errors.slice(0, 5).join(" | ") : null,
      metadata: {
        promoted,
        demoted,
        restored,
        unchanged,
      },
    });

    return {
      runId,
      status,
      channelsEvaluated: channels.length,
      promoted,
      demoted,
      restored,
      unchanged,
      errors,
    };
  } catch (error) {
    await deps.finishRun(runId, {
      status: "failed",
      itemsProcessed: 0,
      itemsDiscovered: 0,
      itemsFailed: 1,
      youtubeQuotaEstimate: 0,
      errorSummary:
        error instanceof Error ? error.message : "Auto watchlist failed",
      metadata: null,
    });
    throw error;
  }
}
