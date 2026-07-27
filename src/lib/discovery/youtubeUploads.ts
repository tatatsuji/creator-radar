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

export async function fetchDiscoveredUploadVideos(
  channelId: string,
  maxResults: number = DEFAULT_UPLOADS_FETCH_LIMIT,
): Promise<{ items: YouTubeVideoItem[]; quotaUsed: number }> {
  const uploadsPlaylistId = await fetchChannelUploadsPlaylistId(channelId);
  const videoIds = await fetchLatestUploadVideoIds(
    uploadsPlaylistId,
    maxResults,
  );

  if (videoIds.length === 0) {
    return { items: [], quotaUsed: 2 };
  }

  const response = await youtubeFetch<YouTubeVideosResponse>(
    "videos",
    {
      part: "snippet,statistics,contentDetails",
      id: videoIds.join(","),
    },
    0,
  );

  const items = response.items.filter(
    (item) =>
      item.id &&
      item.snippet?.title &&
      item.snippet.publishedAt &&
      item.snippet.channelId,
  );

  return { items, quotaUsed: 3 };
}

export const YOUTUBE_UPLOADS_QUOTA = {
  perChannelWithVideos: 3,
  perChannelWithoutVideos: 2,
} as const;
