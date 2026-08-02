import { classifyYouTubeVideoItem } from "@/lib/discovery/videoClassification";
import { getYouTubeCategoryId, KNOWN_CATEGORY_IDS } from "@/lib/youtube/categories";
import type { YouTubeVideoItem } from "@/lib/youtube/types";
import type { GenreId } from "@/types";

export function isTopicChannelName(channelName: string): boolean {
  return / - Topic$/i.test(channelName) || /^Release - Topic$/i.test(channelName);
}

export function filterRegularFormVideos(items: YouTubeVideoItem[]): YouTubeVideoItem[] {
  return items.filter((item) => {
    const { videoFormat, liveState } = classifyYouTubeVideoItem(item);
    return videoFormat === "regular" && liveState === "none";
  });
}

/** @deprecated use filterRegularFormVideos */
export function filterShortFormVideos(items: YouTubeVideoItem[]): YouTubeVideoItem[] {
  return filterRegularFormVideos(items);
}

export function filterByGenreCategory(
  items: YouTubeVideoItem[],
  genre: GenreId,
): YouTubeVideoItem[] {
  if (genre === "all") {
    return items;
  }

  if (genre === "shorts") {
    return items.filter((item) => {
      const { videoFormat, liveState } = classifyYouTubeVideoItem(item);
      return videoFormat === "short" && liveState === "none";
    });
  }

  if (genre === "other") {
    return items.filter((item) => {
      const categoryId = item.snippet.categoryId;
      if (!categoryId) {
        return true;
      }

      return !KNOWN_CATEGORY_IDS.includes(categoryId);
    });
  }

  const categoryId = getYouTubeCategoryId(genre);
  if (!categoryId) {
    return items;
  }

  return items.filter((item) => item.snippet.categoryId === categoryId);
}

export function mergeVideoItems(
  ...groups: YouTubeVideoItem[][]
): YouTubeVideoItem[] {
  const merged = new Map<string, YouTubeVideoItem>();

  for (const group of groups) {
    for (const item of group) {
      merged.set(item.id, item);
    }
  }

  return [...merged.values()];
}
