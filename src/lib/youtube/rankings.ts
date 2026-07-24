import type { GenreId, RankingPeriod, Video } from "@/types";

import { getYouTubeCategoryId } from "@/lib/youtube/categories";
import { youtubeFetch } from "@/lib/youtube/client";
import {
  applyTrendingScores,
  buildVideoMetrics,
} from "@/lib/ranking/metrics";
import { mergeSnapshotMetricsIntoVideos } from "@/lib/ranking/snapshotMetrics";
import type {
  YouTubeChannelItem,
  YouTubeChannelsResponse,
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideosResponse,
} from "@/lib/youtube/types";

const MAX_RESULTS = 50;

const KNOWN_CATEGORY_IDS = [
  "24",
  "10",
  "20",
  "27",
  "25",
  "26",
  "17",
];

function getPublishedAfter(period: RankingPeriod): string {
  const date = new Date();
  const hours =
    period === "24h" ? 24 : period === "3d" ? 24 * 3 : 24 * 7;
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function pickThumbnail(
  thumbnails: YouTubeVideoItem["snippet"]["thumbnails"],
): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    "/placeholder-thumbnail.svg"
  );
}

function parseCount(value?: string): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapVideoItem(
  item: YouTubeVideoItem,
  channel: YouTubeChannelItem | undefined,
  period: RankingPeriod,
) {
  const viewCount = parseCount(item.statistics?.viewCount);
  const subscriberCountHidden =
    channel?.statistics?.hiddenSubscriberCount === true;
  const subscriberCount = subscriberCountHidden
    ? 0
    : parseCount(channel?.statistics?.subscriberCount);

  const metrics = buildVideoMetrics(
    period,
    viewCount,
    subscriberCount,
    subscriberCountHidden,
    item.snippet.publishedAt,
  );

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
    publishedAt: item.snippet.publishedAt,
    channel: {
      id: item.snippet.channelId,
      name: channel?.snippet.title ?? item.snippet.channelTitle,
      subscriberCount,
      subscriberCountHidden,
      thumbnailUrl: channel?.snippet.thumbnails?.default?.url,
    },
    viewCount,
    metrics,
  };
}

async function fetchChannels(
  channelIds: string[],
): Promise<Map<string, YouTubeChannelItem>> {
  if (channelIds.length === 0) {
    return new Map();
  }

  const response = await youtubeFetch<YouTubeChannelsResponse>("channels", {
    part: "snippet,statistics",
    id: channelIds.join(","),
    maxResults: String(Math.min(channelIds.length, 50)),
  });

  return new Map(response.items.map((item) => [item.id, item]));
}

async function enrichVideos(
  videoItems: YouTubeVideoItem[],
  period: RankingPeriod,
): Promise<Video[]> {
  const uniqueChannelIds = [
    ...new Set(videoItems.map((item) => item.snippet.channelId)),
  ];
  const channels = await fetchChannels(uniqueChannelIds);

  const mapped = videoItems.map((item) =>
    mapVideoItem(item, channels.get(item.snippet.channelId), period),
  );

  const withSnapshotMetrics = await mergeSnapshotMetricsIntoVideos(
    mapped,
    period,
  );

  return applyTrendingScores(withSnapshotMetrics).sort(
    (a, b) => b.metrics.rankingScore - a.metrics.rankingScore,
  );
}

async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideoItem[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const response = await youtubeFetch<YouTubeVideosResponse>("videos", {
    part: "snippet,statistics",
    id: videoIds.join(","),
    maxResults: String(Math.min(videoIds.length, 50)),
  });

  return response.items;
}

async function fetchMostPopularVideos(
  genre: GenreId,
): Promise<YouTubeVideoItem[]> {
  const params: Record<string, string> = {
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode: "JP",
    maxResults: String(MAX_RESULTS),
  };

  const categoryId = getYouTubeCategoryId(genre);
  if (categoryId) {
    params.videoCategoryId = categoryId;
  }

  const response = await youtubeFetch<YouTubeVideosResponse>("videos", params);
  return response.items;
}

function filterByPublishedAfter(
  items: YouTubeVideoItem[],
  period: RankingPeriod,
): YouTubeVideoItem[] {
  const afterMs = new Date(getPublishedAfter(period)).getTime();
  return items.filter(
    (item) => new Date(item.snippet.publishedAt).getTime() >= afterMs,
  );
}

async function getVideoItemsForPeriod(
  period: RankingPeriod,
  genre: GenreId,
): Promise<YouTubeVideoItem[]> {
  if (period === "24h") {
    if (genre === "other") {
      const searched = await searchVideos(period, genre);
      if (searched.length > 0) {
        return searched;
      }
      return filterByPublishedAfter(await fetchMostPopularVideos("all"), period);
    }
    return fetchMostPopularVideos(genre);
  }

  const searched = await searchVideos(period, genre);
  if (searched.length > 0) {
    return searched;
  }

  const popularGenre = genre === "other" ? "all" : genre;
  return filterByPublishedAfter(
    await fetchMostPopularVideos(popularGenre),
    period,
  );
}

async function searchVideos(
  period: RankingPeriod,
  genre: GenreId,
): Promise<YouTubeVideoItem[]> {
  const params: Record<string, string> = {
    part: "snippet",
    type: "video",
    regionCode: "JP",
    relevanceLanguage: "ja",
    order: "viewCount",
    publishedAfter: getPublishedAfter(period),
    maxResults: String(MAX_RESULTS),
  };

  const categoryId = getYouTubeCategoryId(genre);
  if (categoryId) {
    params.videoCategoryId = categoryId;
  }

  const searchResponse = await youtubeFetch<YouTubeSearchResponse>(
    "search",
    params,
  );

  const videoIds = searchResponse.items
    .map((item) => item.id.videoId)
    .filter((id): id is string => Boolean(id));

  return fetchVideoDetails(videoIds);
}

export async function getCollectTargetVideoItems(): Promise<YouTubeVideoItem[]> {
  const periods: RankingPeriod[] = ["24h", "3d", "7d"];
  const videosById = new Map<string, YouTubeVideoItem>();

  for (const period of periods) {
    const items = await getVideoItemsForPeriod(period, "all");
    for (const item of items) {
      videosById.set(item.id, item);
    }
  }

  return [...videosById.values()];
}

export async function getRankings(
  period: RankingPeriod,
  genre: GenreId,
): Promise<Video[]> {
  const videoItems = await getVideoItemsForPeriod(period, genre);

  const filteredItems =
    genre === "other"
      ? videoItems.filter((item) => {
          const categoryId = item.snippet.categoryId;
          if (!categoryId) {
            return true;
          }
          return !KNOWN_CATEGORY_IDS.includes(categoryId);
        })
      : videoItems;

  return enrichVideos(filteredItems, period);
}

export async function getVideoById(
  id: string,
  period: RankingPeriod = "24h",
): Promise<Video | null> {
  const response = await youtubeFetch<YouTubeVideosResponse>("videos", {
    part: "snippet,statistics",
    id,
    maxResults: "1",
  });

  const item = response.items[0];
  if (!item) {
    return null;
  }

  const channels = await fetchChannels([item.snippet.channelId]);
  const mapped = [
    mapVideoItem(item, channels.get(item.snippet.channelId), period),
  ];
  const [withSnapshotMetrics] = await mergeSnapshotMetricsIntoVideos(
    mapped,
    period,
  );
  const [video] = applyTrendingScores([withSnapshotMetrics]);

  return video ?? null;
}

export function getRankingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "ランキングデータの取得に失敗しました。";
}
