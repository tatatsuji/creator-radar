import { touchChannelLastUploadAtIfNewer } from "@/lib/channels/channelUploadStatsRepository";
import { buildWatchlistUploadSourceKey } from "@/lib/discovery/sourceKey";
import {
  buildChannelUpsertFromYouTube,
  buildVideoUpsertFromYouTubeItem,
} from "@/lib/discovery/parseYouTubeVideoForStorage";
import {
  fetchDiscoveredUploadVideos,
  fetchSafetyPollUploadVideos,
  YOUTUBE_UPLOADS_QUOTA,
} from "@/lib/discovery/youtubeUploads";
import { registerDiscoveryCandidate } from "@/lib/discovery/registerDiscoveryCandidate";
import {
  finishDiscoveryRun,
  findRecentRunningDiscoveryRun,
  startDiscoveryRun,
} from "@/lib/discovery/runsRepository";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import { upsertChannelRecord } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isWebsubEnabled, WEBSUB_CONFIG } from "@/lib/websub/websubConfig";
import { getWebsubSubscriptionByChannelId } from "@/lib/websub/websubSubscriptionRepository";
import {
  getWatchlistPollNextCheckAt,
  resolveWatchlistPollMode,
  type WatchlistPollMode,
} from "@/lib/websub/watchlistPollPolicy";
import { fetchYouTubeChannelsByIds } from "@/lib/youtube/rankings";
import type { GenreId } from "@/types";
import {
  acquireWatchlistLock,
  getDueWatchlistChannels,
  markWatchlistChecked,
  markWatchlistFailure,
  releaseWatchlistLock,
  updateWatchlistNextCheckAt,
  type WatchlistLockHandle,
} from "@/lib/watchlist/repository";
import type { ChannelWatchlistRow } from "@/types/database";
import { isWatchTier } from "@/types/observability";

export interface WatchlistDiscoveryResult {
  runId: string;
  status: "success" | "partial" | "failed";
  channelsDue: number;
  channelsProcessed: number;
  channelsFailed: number;
  channelsSkippedWebsubHealthy: number;
  channelsSafetyPoll: number;
  channelsNormalPoll: number;
  videosDiscovered: number;
  discoveriesInserted: number;
  discoveriesDuplicate: number;
  youtubeQuotaEstimate: number;
  errors: string[];
}

export interface WatchlistDiscoveryDeps {
  getDueChannels: typeof getDueWatchlistChannels;
  acquireLock: typeof acquireWatchlistLock;
  releaseLock: typeof releaseWatchlistLock;
  fetchUploadVideos: typeof fetchDiscoveredUploadVideos;
  fetchSafetyPollVideos: typeof fetchSafetyPollUploadVideos;
  fetchChannels: typeof fetchYouTubeChannelsByIds;
  upsertChannel: typeof upsertChannelRecord;
  registerDiscoveryCandidate: typeof registerDiscoveryCandidate;
  markChecked: typeof markWatchlistChecked;
  markFailure: typeof markWatchlistFailure;
  touchLastUploadAt: typeof touchChannelLastUploadAtIfNewer;
  findRunningRun: typeof findRecentRunningDiscoveryRun;
  startRun: typeof startDiscoveryRun;
  finishRun: typeof finishDiscoveryRun;
  isWebsubEnabled: () => boolean;
  getWebsubSubscription: typeof getWebsubSubscriptionByChannelId;
  resolvePollMode: typeof resolveWatchlistPollMode;
  updateNextCheckAt: typeof updateWatchlistNextCheckAt;
  now: () => Date;
}

const defaultDeps: WatchlistDiscoveryDeps = {
  getDueChannels: getDueWatchlistChannels,
  acquireLock: acquireWatchlistLock,
  releaseLock: releaseWatchlistLock,
  fetchUploadVideos: fetchDiscoveredUploadVideos,
  fetchSafetyPollVideos: fetchSafetyPollUploadVideos,
  fetchChannels: fetchYouTubeChannelsByIds,
  upsertChannel: upsertChannelRecord,
  registerDiscoveryCandidate,
  markChecked: markWatchlistChecked,
  markFailure: markWatchlistFailure,
  touchLastUploadAt: touchChannelLastUploadAtIfNewer,
  findRunningRun: findRecentRunningDiscoveryRun,
  startRun: startDiscoveryRun,
  finishRun: finishDiscoveryRun,
  isWebsubEnabled,
  getWebsubSubscription: getWebsubSubscriptionByChannelId,
  resolvePollMode: resolveWatchlistPollMode,
  updateNextCheckAt: updateWatchlistNextCheckAt,
  now: () => new Date(),
};

async function processWatchlistChannel(
  channel: ChannelWatchlistRow,
  deps: WatchlistDiscoveryDeps,
): Promise<{
  videosDiscovered: number;
  discoveriesInserted: number;
  discoveriesDuplicate: number;
  quotaUsed: number;
  pollMode: WatchlistPollMode | "locked";
  error?: string;
}> {
  let lock: WatchlistLockHandle | null = null;

  try {
    lock = await deps.acquireLock(channel.channel_id);
    if (!lock) {
      return {
        videosDiscovered: 0,
        discoveriesInserted: 0,
        discoveriesDuplicate: 0,
        quotaUsed: 0,
        pollMode: "locked",
        error: `Channel ${channel.channel_id} is locked`,
      };
    }

    const now = deps.now();
    const subscription = deps.isWebsubEnabled()
      ? await deps.getWebsubSubscription(channel.channel_id)
      : null;
    const pollDecision = deps.resolvePollMode({
      websubEnabled: deps.isWebsubEnabled(),
      subscriptionHealth: subscription?.subscription_health ?? null,
      lastCheckedAt: channel.last_checked_at,
      now,
      safetyPollIntervalMs: WEBSUB_CONFIG.safetyPollIntervalMs,
    });

    if (pollDecision.mode === "skip") {
      await deps.updateNextCheckAt(
        channel.channel_id,
        getWatchlistPollNextCheckAt({
          mode: "skip",
          lastCheckedAt: channel.last_checked_at,
          now,
          safetyPollIntervalMs: WEBSUB_CONFIG.safetyPollIntervalMs,
        }),
      );

      return {
        videosDiscovered: 0,
        discoveriesInserted: 0,
        discoveriesDuplicate: 0,
        quotaUsed: 0,
        pollMode: "skip",
      };
    }

    const { items, quotaUsed } =
      pollDecision.mode === "safety"
        ? await deps.fetchSafetyPollVideos(channel.channel_id)
        : await deps.fetchUploadVideos(channel.channel_id);

    const channels = await deps.fetchChannels([channel.channel_id]);
    const channelDetails = channels.get(channel.channel_id);

    if (items.length > 0) {
      await deps.upsertChannel(
        buildChannelUpsertFromYouTube(
          channelDetails,
          channel.channel_id,
          channel.name ?? items[0]?.snippet.channelTitle ?? channel.channel_id,
        ),
      );
    }

    const nowIso = deps.now().toISOString();
    let discoveriesInserted = 0;
    let discoveriesDuplicate = 0;

    if (items.length > 0) {
      const latestPublishedAt = items.reduce((latest, item) => {
        const publishedAt = item.snippet.publishedAt;
        return publishedAt > latest ? publishedAt : latest;
      }, items[0]!.snippet.publishedAt);

      await deps.touchLastUploadAt(channel.channel_id, latestPublishedAt);
    }

    for (const item of items) {
      const registration = await deps.registerDiscoveryCandidate({
        video: buildVideoUpsertFromYouTubeItem({
          item,
          channel: channelDetails,
          lastSeenAt: nowIso,
        }),
        channel: buildChannelUpsertFromYouTube(
          channelDetails,
          channel.channel_id,
          channel.name ?? item.snippet.channelTitle ?? channel.channel_id,
        ),
        sourceType: "watchlist_upload",
        sourceKey: buildWatchlistUploadSourceKey(channel.channel_id),
        genreHint: channel.category as GenreId | undefined,
        metadata: {
          watchlistSource: channel.source,
          watchlistCategory: channel.category,
          publishedAt: item.snippet.publishedAt,
        },
        registrationPath: "watchlist_discovery",
      });

      if (registration.discoveryInserted) {
        discoveriesInserted += 1;
      } else {
        discoveriesDuplicate += 1;
      }
    }

    await deps.markChecked(
      channel.channel_id,
      isWatchTier(channel.watch_tier)
        ? channel.watch_tier
        : OBSERVABILITY_CONFIG.defaults.watchTier,
      pollDecision.mode === "safety"
        ? {
            nextCheckAt: getWatchlistPollNextCheckAt({
              mode: "safety",
              lastCheckedAt: channel.last_checked_at,
              now,
              safetyPollIntervalMs: WEBSUB_CONFIG.safetyPollIntervalMs,
            }),
          }
        : undefined,
    );

    return {
      videosDiscovered: items.length,
      discoveriesInserted,
      discoveriesDuplicate,
      quotaUsed,
      pollMode: pollDecision.mode,
    };
  } catch (error) {
    await deps.markFailure(channel.channel_id);
    return {
      videosDiscovered: 0,
      discoveriesInserted: 0,
      discoveriesDuplicate: 0,
      quotaUsed: YOUTUBE_UPLOADS_QUOTA.perChannelWithoutVideos,
      pollMode: "locked",
      error:
        error instanceof Error
          ? `${channel.channel_id}: ${error.message}`
          : `${channel.channel_id}: Unknown discovery error`,
    };
  } finally {
    if (lock) {
      await deps.releaseLock(lock);
    }
  }
}

export async function runWatchlistDiscovery(
  deps: WatchlistDiscoveryDeps = defaultDeps,
): Promise<WatchlistDiscoveryResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const running = await deps.findRunningRun();
  if (running) {
    throw new Error("Discovery is already in progress.");
  }

  const dueChannels = await deps.getDueChannels(
    OBSERVABILITY_CONFIG.batchSize.watchlistCheck,
  );

  const runId = await deps.startRun("watchlist_check");

  let channelsProcessed = 0;
  let channelsFailed = 0;
  let channelsSkippedWebsubHealthy = 0;
  let channelsSafetyPoll = 0;
  let channelsNormalPoll = 0;
  let videosDiscovered = 0;
  let discoveriesInserted = 0;
  let discoveriesDuplicate = 0;
  let youtubeQuotaEstimate = 0;
  const errors: string[] = [];

  for (const channel of dueChannels) {
    const result = await processWatchlistChannel(channel, deps);
    youtubeQuotaEstimate += result.quotaUsed;

    if (result.pollMode === "skip") {
      channelsSkippedWebsubHealthy += 1;
      channelsProcessed += 1;
      continue;
    }

    if (result.error) {
      channelsFailed += 1;
      errors.push(result.error);
      continue;
    }

    channelsProcessed += 1;
    if (result.pollMode === "safety") {
      channelsSafetyPoll += 1;
    } else if (result.pollMode === "normal") {
      channelsNormalPoll += 1;
    }
    videosDiscovered += result.videosDiscovered;
    discoveriesInserted += result.discoveriesInserted;
    discoveriesDuplicate += result.discoveriesDuplicate;
  }

  const status =
    channelsFailed === 0
      ? "success"
      : channelsProcessed > 0
        ? "partial"
        : "failed";

  await deps.finishRun(runId, {
    status,
    itemsProcessed: channelsProcessed,
    itemsDiscovered: discoveriesInserted,
    itemsFailed: channelsFailed,
    youtubeQuotaEstimate,
    errorSummary: errors.length > 0 ? errors.slice(0, 5).join(" | ") : null,
    metadata: {
      channelsDue: dueChannels.length,
      videosDiscovered,
      discoveriesDuplicate,
      channelsSkippedWebsubHealthy,
      channelsSafetyPoll,
      channelsNormalPoll,
    },
  });

  return {
    runId,
    status,
    channelsDue: dueChannels.length,
    channelsProcessed,
    channelsFailed,
    channelsSkippedWebsubHealthy,
    channelsSafetyPoll,
    channelsNormalPoll,
    videosDiscovered,
    discoveriesInserted,
    discoveriesDuplicate,
    youtubeQuotaEstimate,
    errors,
  };
}
