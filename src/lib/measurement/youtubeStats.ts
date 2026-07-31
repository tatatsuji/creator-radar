import { classifyYouTubeFetchError } from "@/lib/youtube/apiErrors";
import { youtubeFetch } from "@/lib/youtube/client";
import { parseCount } from "@/lib/youtube/helpers";
import { computeMissingVideoIds } from "@/lib/video/videoAvailability";
import type { YouTubeChannelsResponse, YouTubeVideosResponse } from "@/lib/youtube/types";

export interface VideoStatistics {
  videoId: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
}

export interface VideoStatisticsBatchResult {
  statistics: VideoStatistics[];
  missingVideoIds: string[];
  quotaUsed: number;
}

const MAX_VIDEO_IDS_PER_REQUEST = 50;

export async function fetchVideoStatisticsBatch(
  videoIds: string[],
): Promise<VideoStatisticsBatchResult> {
  if (videoIds.length === 0) {
    return { statistics: [], missingVideoIds: [], quotaUsed: 0 };
  }

  if (videoIds.length > MAX_VIDEO_IDS_PER_REQUEST) {
    throw new Error(`videoIds batch exceeds ${MAX_VIDEO_IDS_PER_REQUEST}`);
  }

  try {
    const response = await youtubeFetch<YouTubeVideosResponse>(
      "videos",
      {
        part: "statistics",
        id: videoIds.join(","),
      },
      0,
    );

    const statistics = (response.items ?? []).map((item) => ({
      videoId: item.id,
      viewCount: parseCount(item.statistics?.viewCount),
      likeCount: item.statistics?.likeCount
        ? parseCount(item.statistics.likeCount)
        : null,
      commentCount: item.statistics?.commentCount
        ? parseCount(item.statistics.commentCount)
        : null,
    }));

    const missingVideoIds = computeMissingVideoIds(
      videoIds,
      statistics.map((entry) => entry.videoId),
    );

    return { statistics, missingVideoIds, quotaUsed: 1 };
  } catch (error) {
    throw classifyYouTubeFetchError(error);
  }
}

const MAX_CHANNEL_IDS_PER_REQUEST = 50;

export async function fetchChannelSubscriberCountsBatch(
  channelIds: string[],
): Promise<{ subscriberCounts: Map<string, number | null>; quotaUsed: number }> {
  const uniqueIds = [...new Set(channelIds.filter(Boolean))];
  const subscriberCounts = new Map<string, number | null>();

  if (uniqueIds.length === 0) {
    return { subscriberCounts, quotaUsed: 0 };
  }

  let quotaUsed = 0;

  for (let index = 0; index < uniqueIds.length; index += MAX_CHANNEL_IDS_PER_REQUEST) {
    const batch = uniqueIds.slice(index, index + MAX_CHANNEL_IDS_PER_REQUEST);
    const response = await youtubeFetch<YouTubeChannelsResponse>(
      "channels",
      {
        part: "statistics",
        id: batch.join(","),
      },
      0,
    );
    quotaUsed += 1;

    for (const item of response.items ?? []) {
      const hidden = item.statistics?.hiddenSubscriberCount === true;
      subscriberCounts.set(
        item.id,
        hidden ? null : parseCount(item.statistics?.subscriberCount),
      );
    }
  }

  return { subscriberCounts, quotaUsed };
}

export const YOUTUBE_VIDEOS_LIST_QUOTA_PER_BATCH = 1;
