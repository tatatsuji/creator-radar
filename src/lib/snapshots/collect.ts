import { parseCount, pickVideoThumbnail } from "@/lib/youtube/helpers";
import {
  fetchYouTubeChannelsByIds,
  getCollectTargetVideoItems,
} from "@/lib/youtube/rankings";

import {
  createSnapshotRun,
  finishSnapshotRun,
  findRecentRunningSnapshotRun,
  insertChannelSnapshotIfNeeded,
  insertVideoSnapshotIfNeeded,
  upsertChannelRecord,
  upsertVideoRecord,
} from "@/lib/snapshots/repository";

const MAX_COLLECT_VIDEOS = 200;
const YOUTUBE_QUOTA_PER_VIDEO_BATCH = 1;
const YOUTUBE_QUOTA_PER_CHANNEL_BATCH = 1;
const YOUTUBE_QUOTA_RANKING_FETCH = 12;

export interface CollectSnapshotsResult {
  runId: string;
  total: number;
  success: number;
  skipped: number;
  failed: number;
  channelsTotal: number;
  channelsSuccess: number;
  channelsSkipped: number;
  youtubeQuotaUsed: number;
  errors: Array<{ videoId: string; message: string }>;
}

function estimateYoutubeQuota(channelBatchCount: number): number {
  return (
    YOUTUBE_QUOTA_RANKING_FETCH +
    YOUTUBE_QUOTA_PER_VIDEO_BATCH +
    channelBatchCount * YOUTUBE_QUOTA_PER_CHANNEL_BATCH
  );
}

export async function collectVideoSnapshots(): Promise<CollectSnapshotsResult> {
  const running = await findRecentRunningSnapshotRun();
  if (running) {
    throw new Error("Snapshot collection is already in progress.");
  }

  const runId = await createSnapshotRun();
  const capturedAt = new Date().toISOString();
  const errors: CollectSnapshotsResult["errors"] = [];

  let videoItems = await getCollectTargetVideoItems();
  if (videoItems.length > MAX_COLLECT_VIDEOS) {
    videoItems = videoItems.slice(0, MAX_COLLECT_VIDEOS);
  }

  const channelIds = [...new Set(videoItems.map((item) => item.snippet.channelId))];
  const channels = await fetchYouTubeChannelsByIds(channelIds);
  const channelBatchCount = Math.ceil(channelIds.length / 50) || 0;

  let videosSuccess = 0;
  let videosSkipped = 0;
  let videosFailed = 0;
  let channelsSuccess = 0;
  let channelsSkipped = 0;

  try {
    for (const channelId of channelIds) {
      const channel = channels.get(channelId);
      if (!channel) {
        continue;
      }

      const subscriberCountHidden =
        channel.statistics?.hiddenSubscriberCount === true;

      await upsertChannelRecord({
        youtubeChannelId: channelId,
        name: channel.snippet.title,
        thumbnailUrl: channel.snippet.thumbnails?.default?.url,
        subscriberCountHidden,
      });

      const channelSnapshotResult = await insertChannelSnapshotIfNeeded({
        channelId,
        subscriberCount: subscriberCountHidden
          ? null
          : parseCount(channel.statistics?.subscriberCount),
        capturedAt,
      });

      if (channelSnapshotResult === "inserted") {
        channelsSuccess += 1;
      } else {
        channelsSkipped += 1;
      }
    }

    for (const item of videoItems) {
      try {
        await upsertVideoRecord({
          youtubeVideoId: item.id,
          title: item.snippet.title,
          channelId: item.snippet.channelId,
          channelName: item.snippet.channelTitle,
          thumbnailUrl: pickVideoThumbnail(item),
          publishedAt: item.snippet.publishedAt,
          categoryId: item.snippet.categoryId,
          lastSeenAt: capturedAt,
        });

        const channel = channels.get(item.snippet.channelId);
        const subscriberCountHidden =
          channel?.statistics?.hiddenSubscriberCount === true;
        const subscriberCount =
          !channel || subscriberCountHidden
            ? null
            : parseCount(channel.statistics?.subscriberCount);

        const snapshotResult = await insertVideoSnapshotIfNeeded({
          videoId: item.id,
          viewCount: parseCount(item.statistics?.viewCount),
          likeCount: parseCount(item.statistics?.likeCount),
          commentCount: parseCount(item.statistics?.commentCount),
          subscriberCount,
          capturedAt,
        });

        if (snapshotResult === "inserted") {
          videosSuccess += 1;
        } else {
          videosSkipped += 1;
        }
      } catch (error) {
        videosFailed += 1;
        errors.push({
          videoId: item.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const youtubeQuotaUsed = estimateYoutubeQuota(channelBatchCount);
    const status =
      videosFailed > 0
        ? errors.length === videoItems.length
          ? "failed"
          : "partial"
        : "success";

    await finishSnapshotRun(runId, {
      status,
      videosTotal: videoItems.length,
      videosSuccess,
      videosFailed,
      videosSkipped,
      channelsTotal: channelIds.length,
      channelsSuccess,
      channelsSkipped,
      youtubeQuotaUsed,
      errorSummary:
        errors.length > 0
          ? `${errors.length} video(s) failed during collection`
          : null,
    });

    return {
      runId,
      total: videoItems.length,
      success: videosSuccess,
      skipped: videosSkipped,
      failed: videosFailed,
      channelsTotal: channelIds.length,
      channelsSuccess,
      channelsSkipped,
      youtubeQuotaUsed,
      errors,
    };
  } catch (error) {
    await finishSnapshotRun(runId, {
      status: "failed",
      videosTotal: videoItems.length,
      videosSuccess,
      videosFailed,
      videosSkipped,
      channelsTotal: channelIds.length,
      channelsSuccess,
      channelsSkipped,
      youtubeQuotaUsed: estimateYoutubeQuota(channelBatchCount),
      errorSummary: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
