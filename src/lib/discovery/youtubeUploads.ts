import {
  clearUploadsPlaylistId,
  getCachedUploadsPlaylistId,
  saveUploadsPlaylistId,
} from "@/lib/channels/uploadsPlaylistRepository";
import { youtubeFetch } from "@/lib/youtube/client";
import type { YouTubeVideoItem, YouTubeVideosResponse } from "@/lib/youtube/types";

export interface ChannelUploadPlaylist {
  channelId: string;
  uploadsPlaylistId: string;
}

interface YouTubeChannelContentDetailsItem {
  id: string;
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface YouTubeChannelsContentDetailsResponse {
  items: YouTubeChannelContentDetailsItem[];
}

interface YouTubePlaylistItemSnippet {
  resourceId?: {
    videoId?: string;
  };
}

interface YouTubePlaylistItemsResponse {
  items: Array<{
    snippet?: YouTubePlaylistItemSnippet;
  }>;
}

const DEFAULT_UPLOADS_FETCH_LIMIT = 5;

export function isInvalidUploadsPlaylistError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("playlist not found") ||
    message.includes("playlistid") ||
    message.includes("invalid value") ||
    message.includes("cannot find")
  );
}

export async function fetchChannelUploadsPlaylistId(
  channelId: string,
): Promise<string> {
  const response = await youtubeFetch<YouTubeChannelsContentDetailsResponse>(
    "channels",
    {
      part: "contentDetails",
      id: channelId,
    },
    0,
  );

  const uploadsPlaylistId =
    response.items[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error(`Uploads playlist not found for channel ${channelId}`);
  }

  return uploadsPlaylistId;
}

export async function fetchLatestUploadVideoIds(
  uploadsPlaylistId: string,
  maxResults: number = DEFAULT_UPLOADS_FETCH_LIMIT,
): Promise<string[]> {
  const response = await youtubeFetch<YouTubePlaylistItemsResponse>(
    "playlistItems",
    {
      part: "snippet",
      playlistId: uploadsPlaylistId,
      maxResults: String(maxResults),
    },
    0,
  );

  return response.items
    .map((item) => item.snippet?.resourceId?.videoId)
    .filter((videoId): videoId is string => Boolean(videoId));
}

export interface FetchDiscoveredUploadVideosDeps {
  getCachedUploadsPlaylistId: typeof getCachedUploadsPlaylistId;
  saveUploadsPlaylistId: typeof saveUploadsPlaylistId;
  clearUploadsPlaylistId: typeof clearUploadsPlaylistId;
  fetchChannelUploadsPlaylistId: typeof fetchChannelUploadsPlaylistId;
  fetchLatestUploadVideoIds: typeof fetchLatestUploadVideoIds;
}

const defaultFetchDiscoveredUploadVideosDeps: FetchDiscoveredUploadVideosDeps = {
  getCachedUploadsPlaylistId,
  saveUploadsPlaylistId,
  clearUploadsPlaylistId,
  fetchChannelUploadsPlaylistId,
  fetchLatestUploadVideoIds,
};

async function resolveUploadsPlaylistId(
  channelId: string,
  deps: FetchDiscoveredUploadVideosDeps,
): Promise<{ uploadsPlaylistId: string; quotaUsed: number; fromCache: boolean }> {
  const cached = await deps.getCachedUploadsPlaylistId(channelId);
  if (cached) {
    return { uploadsPlaylistId: cached, quotaUsed: 0, fromCache: true };
  }

  const uploadsPlaylistId =
    await deps.fetchChannelUploadsPlaylistId(channelId);
  await deps.saveUploadsPlaylistId(channelId, uploadsPlaylistId);
  return { uploadsPlaylistId, quotaUsed: 1, fromCache: false };
}

async function fetchUploadVideoItems(
  videoIds: string[],
): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const response = await youtubeFetch<YouTubeVideosResponse>(
    "videos",
    {
      part: "snippet,statistics,contentDetails",
      id: videoIds.join(","),
    },
    0,
  );

  return response.items.filter(
    (item) =>
      item.id &&
      item.snippet?.title &&
      item.snippet.publishedAt &&
      item.snippet.channelId,
  );
}

export async function fetchDiscoveredUploadVideos(
  channelId: string,
  maxResults: number = DEFAULT_UPLOADS_FETCH_LIMIT,
  deps: FetchDiscoveredUploadVideosDeps = defaultFetchDiscoveredUploadVideosDeps,
): Promise<{ items: YouTubeVideoItem[]; quotaUsed: number }> {
  let quotaUsed = 0;
  let retriedAfterInvalidCache = false;

  const resolved = await resolveUploadsPlaylistId(channelId, deps);
  quotaUsed += resolved.quotaUsed;
  let uploadsPlaylistId = resolved.uploadsPlaylistId;

  while (true) {
    try {
      const videoIds = await deps.fetchLatestUploadVideoIds(
        uploadsPlaylistId,
        maxResults,
      );
      quotaUsed += 1;

      if (videoIds.length === 0) {
        return { items: [], quotaUsed };
      }

      const items = await fetchUploadVideoItems(videoIds);
      quotaUsed += 1;
      return { items, quotaUsed };
    } catch (error) {
      const canRetryInvalidCache =
        resolved.fromCache && !retriedAfterInvalidCache && isInvalidUploadsPlaylistError(error);

      if (!canRetryInvalidCache) {
        throw error;
      }

      await deps.clearUploadsPlaylistId(channelId);
      uploadsPlaylistId = await deps.fetchChannelUploadsPlaylistId(channelId);
      await deps.saveUploadsPlaylistId(channelId, uploadsPlaylistId);
      quotaUsed += 1;
      retriedAfterInvalidCache = true;
    }
  }
}

export const YOUTUBE_UPLOADS_QUOTA = {
  perChannelWithVideos: 3,
  perChannelWithVideosCached: 2,
  perChannelWithoutVideos: 2,
  perChannelWithoutVideosCached: 1,
} as const;
