/**
 * Evaluation-only YouTube fetch helpers for Discovery Recall ground truth.
 *
 * Intentionally separate from production discovery fetchers (candidateFetch.ts)
 * to prevent evaluation leak — see docs/evaluation-leak-prevention.md.
 */
import { getPublishedAfter } from "@/lib/ranking/periods";
import {
  genreSupportsPopularChart,
  getYouTubeCategoryId,
} from "@/lib/youtube/categories";
import { youtubeFetch } from "@/lib/youtube/client";
import { YOUTUBE_VIDEO_DETAILS_PARTS } from "@/lib/youtube/videoDetailsParts";
import { isChartNotFoundError } from "@/lib/youtube/errors";
import { mergeVideoItems } from "@/lib/youtube/filters";
import { parseCount } from "@/lib/youtube/helpers";
import type {
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideosResponse,
} from "@/lib/youtube/types";
import type { GenreId, RankingPeriod } from "@/types";

const EVAL_REGION = "JP";

async function evalFetchVideoDetails(
  videoIds: string[],
): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const items: YouTubeVideoItem[] = [];
  for (let index = 0; index < videoIds.length; index += 50) {
    const batch = videoIds.slice(index, index + 50);
    const response = await youtubeFetch<YouTubeVideosResponse>("videos", {
      part: YOUTUBE_VIDEO_DETAILS_PARTS,
      id: batch.join(","),
      maxResults: String(Math.min(batch.length, 50)),
    });
    items.push(...response.items);
  }
  return items;
}

export async function evalSearchVideos(input: {
  period: RankingPeriod;
  genre: GenreId;
  order: "viewCount" | "date" | "relevance";
  maxResults?: number;
  extraParams?: Record<string, string>;
}): Promise<YouTubeVideoItem[]> {
  const params: Record<string, string> = {
    part: "snippet",
    type: "video",
    regionCode: EVAL_REGION,
    order: input.order,
    publishedAfter: getPublishedAfter(input.period),
    maxResults: String(input.maxResults ?? 50),
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

  return evalFetchVideoDetails(videoIds);
}

export async function evalFetchMostPopular(
  genre: GenreId,
  maxResults = 50,
): Promise<YouTubeVideoItem[]> {
  if (!genreSupportsPopularChart(genre)) {
    return [];
  }

  const params: Record<string, string> = {
    part: YOUTUBE_VIDEO_DETAILS_PARTS,
    chart: "mostPopular",
    regionCode: EVAL_REGION,
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

export async function evalFetchChannelSubscribers(
  channelIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (channelIds.length === 0) {
    return result;
  }

  for (let index = 0; index < channelIds.length; index += 50) {
    const batch = channelIds.slice(index, index + 50);
    const response = await youtubeFetch<{
      items: Array<{
        id: string;
        statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
      }>;
    }>("channels", {
      part: "statistics",
      id: batch.join(","),
      maxResults: String(batch.length),
    });

    for (const item of response.items) {
      if (item.statistics?.hiddenSubscriberCount) {
        result.set(item.id, Number.MAX_SAFE_INTEGER);
      } else {
        result.set(item.id, parseCount(item.statistics?.subscriberCount));
      }
    }
  }

  return result;
}

export async function evalFetchShortFormCandidates(
  period: RankingPeriod,
  maxResults: number,
): Promise<YouTubeVideoItem[]> {
  return evalSearchVideos({
    period,
    genre: "all",
    order: "viewCount",
    maxResults,
    extraParams: { videoDuration: "short" },
  });
}

export async function evalFetchLiveCandidates(
  maxResults: number,
): Promise<YouTubeVideoItem[]> {
  const [live, completed] = await Promise.all([
    evalSearchVideos({
      period: "24h",
      genre: "all",
      order: "viewCount",
      maxResults: Math.ceil(maxResults / 2),
      extraParams: { eventType: "live" },
    }),
    evalSearchVideos({
      period: "3d",
      genre: "all",
      order: "viewCount",
      maxResults: Math.ceil(maxResults / 2),
      extraParams: { eventType: "completed" },
    }),
  ]);

  return mergeVideoItems(live, completed).slice(0, maxResults);
}
