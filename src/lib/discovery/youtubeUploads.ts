import { youtubeFetch } from "@/lib/youtube/client";

export interface ChannelUploadPlaylist {
  channelId: string;
  uploadsPlaylistId: string;
}

export interface DiscoveredUploadVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  publishedAt: string;
  thumbnailUrl: string;
  categoryId?: string;
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
  title?: string;
  publishedAt?: string;
  channelId?: string;
  channelTitle?: string;
  resourceId?: {
    videoId?: string;
  };
  thumbnails?: {
    maxres?: { url?: string };
    high?: { url?: string };
    medium?: { url?: string };
    default?: { url?: string };
  };
}

interface YouTubePlaylistItemsResponse {
  items: Array<{
    snippet?: YouTubePlaylistItemSnippet;
  }>;
}

interface YouTubeVideoSnippetItem {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    categoryId?: string;
    thumbnails?: {
      maxres?: { url?: string };
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
}

interface YouTubeVideosResponse {
  items: YouTubeVideoSnippetItem[];
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
): Promise<{ videos: DiscoveredUploadVideo[]; quotaUsed: number }> {
  const uploadsPlaylistId = await fetchChannelUploadsPlaylistId(channelId);
  const videoIds = await fetchLatestUploadVideoIds(
    uploadsPlaylistId,
    maxResults,
  );

  if (videoIds.length === 0) {
    return { videos: [], quotaUsed: 2 };
  }

  const response = await youtubeFetch<YouTubeVideosResponse>(
    "videos",
    {
      part: "snippet",
      id: videoIds.join(","),
    },
    0,
  );

  const videos: DiscoveredUploadVideo[] = [];

  for (const item of response.items) {
    const snippet = item.snippet;
    if (!snippet?.title || !snippet.publishedAt || !snippet.channelId) {
      continue;
    }

    videos.push({
      videoId: item.id,
      title: snippet.title,
      channelId: snippet.channelId,
      channelName: snippet.channelTitle ?? "",
      publishedAt: snippet.publishedAt,
      thumbnailUrl:
        snippet.thumbnails?.maxres?.url ??
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        "/placeholder-thumbnail.svg",
      categoryId: snippet.categoryId,
    });
  }

  return { videos, quotaUsed: 3 };
}

export const YOUTUBE_UPLOADS_QUOTA = {
  perChannelWithVideos: 3,
  perChannelWithoutVideos: 2,
} as const;
