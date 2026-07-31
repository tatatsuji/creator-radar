import { youtubeFetch } from "@/lib/youtube/client";
import type { YouTubeVideoItem, YouTubeVideosResponse } from "@/lib/youtube/types";

export async function fetchWebsubVideoDetailsBatch(
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
