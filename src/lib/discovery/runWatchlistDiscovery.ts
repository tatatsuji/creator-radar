import { buildWatchlistUploadSourceKey } from "@/lib/discovery/sourceKey";
import {
  buildChannelUpsertFromYouTube,
  buildVideoUpsertFromYouTubeItem,
} from "@/lib/discovery/parseYouTubeVideoForStorage";
import {
  fetchDiscoveredUploadVideos,
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
import { fetchYouTubeChannelsByIds } from "@/lib/youtube/rankings";
import type { GenreId } from "@/types";
import {
  acquireWatchlistLock,
  getDueWatchlistChannels,
  incrementWatchlistFailureCount,
  markWatchlistChecked,
  releaseWatchlistLock,
  type WatchlistLockHandle,
} from "@/lib/watchlist/repository";
import type { ChannelWatchlistRow } from "@/types/database";

export interface WatchlistDiscoveryResult {
  runId: string;
  status: "success" | "partial" | "failed";
  channelsDue: number;
  channelsProcessed: number;
  channelsFailed: number;
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
  fetchChannels: typeof fetchYouTubeChannelsByIds;
  upsertChannel: typeof upsertChannelRecord;
  registerDiscoveryCandidate: typeof registerDiscoveryCandidate;
  markChecked: typeof markWatchlistChecked;
  incrementFailure: typeof incrementWatchlistFailureCount;
  findRunningRun: typeof findRecentRunningDiscoveryRun;
  startRun: typeof startDiscoveryRun;
  finishRun: typeof finishDiscoveryRun;
}

const defaultDeps: WatchlistDiscoveryDeps = {
  getDueChannels: getDueWatchlistChannels,
  acquireLock: acquireWatchlistLock,
  releaseLock: releaseWatchlistLock,
  fetchUploadVideos: fetchDiscoveredUploadVideos,
  fetchChannels: fetchYouTubeChannelsByIds,
  upsertChannel: upsertChannelRecord,
  registerDiscoveryCandidate,
  markChecked: markWatchlistChecked,
  incrementFailure: incrementWatchlistFailureCount,
  findRunningRun: findRecentRunningDiscoveryRun,
  startRun: startDiscoveryRun,
  finishRun: finishDiscoveryRun,
};

async function processWatchlistChannel(
  channel: ChannelWatchlistRow,
  deps: WatchlistDiscoveryDeps,
): Promise<{
  videosDiscovered: number;
  discoveriesInserted: number;
  discoveriesDuplicate: number;
  quotaUsed: number;
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
        error: `Channel ${channel.channel_id} is locked`,
      };
    }

    const { items, quotaUsed } = await deps.fetchUploadVideos(
      channel.channel_id,
    );

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

    const now = new Date().toISOString();
    let discoveriesInserted = 0;
    let discoveriesDuplicate = 0;

    for (const item of items) {
      const registration = await deps.registerDiscoveryCandidate({
        video: buildVideoUpsertFromYouTubeItem({
          item,
          channel: channelDetails,
          lastSeenAt: now,
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

    await deps.markChecked(channel.channel_id);

    return {
      videosDiscovered: items.length,
      discoveriesInserted,
      discoveriesDuplicate,
      quotaUsed,
    };
  } catch (error) {
    await deps.incrementFailure(channel.channel_id);
    return {
      videosDiscovered: 0,
      discoveriesInserted: 0,
      discoveriesDuplicate: 0,
      quotaUsed: YOUTUBE_UPLOADS_QUOTA.perChannelWithoutVideos,
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
  let videosDiscovered = 0;
  let discoveriesInserted = 0;
  let discoveriesDuplicate = 0;
  let youtubeQuotaEstimate = 0;
  const errors: string[] = [];

  for (const channel of dueChannels) {
    const result = await processWatchlistChannel(channel, deps);
    youtubeQuotaEstimate += result.quotaUsed;

    if (result.error) {
      channelsFailed += 1;
      errors.push(result.error);
      continue;
    }

    channelsProcessed += 1;
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
    },
  });

  return {
    runId,
    status,
    channelsDue: dueChannels.length,
    channelsProcessed,
    channelsFailed,
    videosDiscovered,
    discoveriesInserted,
    discoveriesDuplicate,
    youtubeQuotaEstimate,
    errors,
  };
}
