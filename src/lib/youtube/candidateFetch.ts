import { getPublishedAfter } from "@/lib/ranking/periods";
import {
  genreSupportsPopularChart,
  getYouTubeCategoryId,
} from "@/lib/youtube/categories";
import { youtubeFetch } from "@/lib/youtube/client";
import { isChartNotFoundError } from "@/lib/youtube/errors";
import {
  filterByGenreCategory,
  mergeVideoItems,
} from "@/lib/youtube/filters";
import type {
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideosResponse,
} from "@/lib/youtube/types";
import type { GenreId, RankingPeriod } from "@/types";

const MAX_RESULTS = 50;

async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const items: YouTubeVideoItem[] = [];

  for (let index = 0; index < videoIds.length; index += 50) {
    const batch = videoIds.slice(index, index + 50);
    const response = await youtubeFetch<YouTubeVideosResponse>("videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
      maxResults: String(Math.min(batch.length, 50)),
    });
    items.push(...response.items);
  }

  return items;
}

export async function searchVideoItems(input: {
  period: RankingPeriod;
  genre: GenreId;
  order: "viewCount" | "date" | "relevance";
  maxResults?: number;
  extraParams?: Record<string, string>;
}): Promise<YouTubeVideoItem[]> {
  const publishedAfter = getPublishedAfter(input.period);
  const params: Record<string, string> = {
    part: "snippet",
    type: "video",
    regionCode: "JP",
    order: input.order,
    publishedAfter,
    maxResults: String(input.maxResults ?? MAX_RESULTS),
    ...input.extraParams,
  };

  const categoryId = getYouTubeCategoryId(input.genre);
  if (categoryId) {
    params.videoCategoryId = categoryId;
  }

  const searchResponse = await youtubeFetch<YouTubeSearchResponse>("search", params);
  const videoIds = searchResponse.items
    .map((item) => item.id.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) {
    return [];
  }

  return fetchVideoDetails(videoIds);
}

export async function fetchMostPopularVideoItems(
  genre: GenreId,
  maxResults = MAX_RESULTS,
): Promise<YouTubeVideoItem[]> {
  if (!genreSupportsPopularChart(genre)) {
    return [];
  }

  const params: Record<string, string> = {
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode: "JP",
    maxResults: String(maxResults),
  };

  const categoryId = getYouTubeCategoryId(genre);
  if (categoryId) {
    params.videoCategoryId = categoryId;
  }

  try {
    const response = await youtubeFetch<YouTubeVideosResponse>("videos", params);
    return response.items;
  } catch (error) {
    if (isChartNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

export async function fetchCategoryDiscoveryItems(input: {
  genre: GenreId;
  period: RankingPeriod;
  maxResultsPerSource: number;
}): Promise<YouTubeVideoItem[]> {
  const [byViews, byDate, popular] = await Promise.all([
    searchVideoItems({
      period: input.period,
      genre: input.genre,
      order: "viewCount",
      maxResults: input.maxResultsPerSource,
    }),
    searchVideoItems({
      period: input.period,
      genre: input.genre,
      order: "date",
      maxResults: input.maxResultsPerSource,
    }),
    fetchMostPopularVideoItems(input.genre, input.maxResultsPerSource),
  ]);

  const merged = mergeVideoItems(byViews, byDate, popular);
  return filterByGenreCategory(merged, input.genre).slice(
    0,
    input.maxResultsPerSource,
  );
}

export async function fetchShortsDiscoveryItems(
  period: RankingPeriod,
  maxResults: number,
): Promise<YouTubeVideoItem[]> {
  return searchVideoItems({
    period,
    genre: "all",
    order: "date",
    maxResults,
    extraParams: { videoDuration: "short" },
  });
}

export async function fetchLiveDiscoveryItems(
  period: RankingPeriod,
  maxResults: number,
): Promise<YouTubeVideoItem[]> {
  return searchVideoItems({
    period,
    genre: "all",
    order: "date",
    maxResults,
    extraParams: { eventType: "live" },
  });
}

export function estimateSearchQuotaUnits(searchCalls: number): number {
  return searchCalls * 100;
}

export function estimateVideosListQuotaUnits(videoCount: number): number {
  return Math.ceil(videoCount / 50);
}
