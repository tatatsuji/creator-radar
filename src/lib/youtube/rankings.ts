import { classifyYouTubeVideoItem } from "@/lib/discovery/videoClassification";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import type { RankingContentFormat } from "@/lib/ranking/rankingContentFormat";
import { matchesRankingContentFormat } from "@/lib/ranking/rankingContentFormat";
import {
  buildVideoMetrics,
  finalizeRankedVideos,
} from "@/lib/ranking/metrics";
import { getPublishedAfter, RANKING_PERIODS } from "@/lib/ranking/periods";
import type { GenreId, RankingPeriod, Video } from "@/types";
import {
  genreSupportsPopularChart,
  getYouTubeCategoryId,
} from "@/lib/youtube/categories";
import { fetchShortFormCandidateItems } from "@/lib/youtube/candidateFetch";
import { youtubeFetch } from "@/lib/youtube/client";
import { isChartNotFoundError } from "@/lib/youtube/errors";
import {
  filterByGenreCategory,
  filterShortFormVideos,
  mergeVideoItems,
} from "@/lib/youtube/filters";
import { parseIsoDurationSeconds } from "@/lib/youtube/duration";
import { parseCount, pickVideoThumbnail } from "@/lib/youtube/helpers";
import { YOUTUBE_VIDEO_DETAILS_PARTS } from "@/lib/youtube/videoDetailsParts";
import type {
  YouTubeChannelItem,
  YouTubeChannelsResponse,
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideosResponse,
} from "@/lib/youtube/types";

const MAX_RESULTS = 50;
const MIN_RESULTS_BEFORE_SUPPLEMENT = 20;

function filterYouTubeItemsByRankingContentFormat(
  items: YouTubeVideoItem[],
  contentFormat: RankingContentFormat,
): YouTubeVideoItem[] {
  return items.filter((item) => {
    const { videoFormat, liveState } = classifyYouTubeVideoItem(item);
    return matchesRankingContentFormat({
      videoFormat,
      liveState,
      contentFormat,
    });
  });
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
  const channelName = channel?.snippet.title ?? item.snippet.channelTitle;
  const durationSeconds = parseIsoDurationSeconds(item.contentDetails?.duration);
  const classification = classifyYouTubeVideoItem(item);

  const metrics = buildVideoMetrics(
    period,
    viewCount,
    subscriberCount,
    subscriberCountHidden,
    item.snippet.publishedAt,
    channelName,
  );

  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: pickVideoThumbnail(item),
    publishedAt: item.snippet.publishedAt,
    channel: {
      id: item.snippet.channelId,
      name: channelName,
      subscriberCount,
      subscriberCountHidden,
      thumbnailUrl: channel?.snippet.thumbnails?.default?.url,
    },
    viewCount,
    metrics,
    durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
    contentKind: classification.contentKind,
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

export async function fetchYouTubeChannelsByIds(
  channelIds: string[],
): Promise<Map<string, YouTubeChannelItem>> {
  const uniqueIds = [...new Set(channelIds)];
  const channels = new Map<string, YouTubeChannelItem>();

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const batch = await fetchChannels(uniqueIds.slice(index, index + 50));
    for (const [id, channel] of batch) {
      channels.set(id, channel);
    }
  }

  return channels;
}

async function mapRankingCandidates(
  videoItems: YouTubeVideoItem[],
  period: RankingPeriod,
): Promise<Video[]> {
  const uniqueChannelIds = [
    ...new Set(videoItems.map((item) => item.snippet.channelId)),
  ];
  const channels = await fetchChannels(uniqueChannelIds);

  return videoItems.map((item) =>
    mapVideoItem(item, channels.get(item.snippet.channelId), period),
  );
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

  return finalizeRankedVideos(mapped, period);
}

async function fetchVideoDetails(videoIds: string[]): Promise<YouTubeVideoItem[]> {
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

async function fetchMostPopularVideos(
  genre: GenreId,
): Promise<YouTubeVideoItem[]> {
  if (!genreSupportsPopularChart(genre)) {
    return [];
  }

  const params: Record<string, string> = {
    part: YOUTUBE_VIDEO_DETAILS_PARTS,
    chart: "mostPopular",
    regionCode: "JP",
    maxResults: String(MAX_RESULTS),
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

function filterByPublishedAfter(
  items: YouTubeVideoItem[],
  period: RankingPeriod,
): YouTubeVideoItem[] {
  const afterMs = new Date(getPublishedAfter(period)).getTime();
  return items.filter(
    (item) => new Date(item.snippet.publishedAt).getTime() >= afterMs,
  );
}

async function searchVideos(
  period: RankingPeriod,
  genre: GenreId,
): Promise<YouTubeVideoItem[]> {
  const publishedAfter = getPublishedAfter(period);
  const orders: Array<"viewCount" | "date"> = ["viewCount", "date"];

  for (const order of orders) {
    const params: Record<string, string> = {
      part: "snippet",
      type: "video",
      regionCode: "JP",
      order,
      publishedAfter,
      maxResults: String(MAX_RESULTS),
    };

    const categoryId = getYouTubeCategoryId(genre);
    if (categoryId) {
      params.videoCategoryId = categoryId;
    }

    if (genre === "shorts") {
      params.videoDuration = "short";
    }

    try {
      const searchResponse = await youtubeFetch<YouTubeSearchResponse>(
        "search",
        params,
      );

      const videoIds = searchResponse.items
        .map((item) => item.id.videoId)
        .filter((id): id is string => Boolean(id));

      if (videoIds.length === 0) {
        continue;
      }

      const videoItems = await fetchVideoDetails(videoIds);
      return videoItems.sort(
        (a, b) =>
          parseCount(b.statistics?.viewCount) - parseCount(a.statistics?.viewCount),
      );
    } catch {
      continue;
    }
  }

  return [];
}

function prepareVideoItems(
  items: YouTubeVideoItem[],
  period: RankingPeriod,
  genre: GenreId,
): YouTubeVideoItem[] {
  const periodFiltered = filterByPublishedAfter(items, period);

  if (genre === "shorts") {
    return filterByGenreCategory(periodFiltered, "shorts").slice(0, MAX_RESULTS);
  }

  const genreFiltered = filterByGenreCategory(periodFiltered, genre);
  const withoutShorts = filterShortFormVideos(genreFiltered);

  return withoutShorts.slice(0, MAX_RESULTS);
}

async function getVideoItemsForPeriod(
  period: RankingPeriod,
  genre: GenreId,
): Promise<YouTubeVideoItem[]> {
  if (genre === "shorts") {
    const items = await fetchShortFormCandidateItems(period, MAX_RESULTS);
    return prepareVideoItems(items, period, genre);
  }

  const searched = await searchVideos(period, genre);
  let combined = searched;

  if (combined.length < MIN_RESULTS_BEFORE_SUPPLEMENT) {
    const supplementGenre = genreSupportsPopularChart(genre) ? genre : "all";
    const popular = await fetchMostPopularVideos(supplementGenre);

    if (popular.length === 0 && supplementGenre !== "all") {
      combined = mergeVideoItems(combined, await fetchMostPopularVideos("all"));
    } else {
      combined = mergeVideoItems(combined, popular);
    }
  }

  let prepared = prepareVideoItems(combined, period, genre);

  if (prepared.length < MIN_RESULTS_BEFORE_SUPPLEMENT) {
    const extraPopular = await fetchMostPopularVideos("all");
    combined = mergeVideoItems(combined, extraPopular);
    prepared = prepareVideoItems(combined, period, genre);
  }

  return prepared;
}

let availableGenresCache: { ids: GenreId[]; expiresAt: number } | null = null;

const BASE_AVAILABLE_GENRES: GenreId[] = [
  "all",
  "shorts",
  "entertainment",
  "music",
  "game",
  "news",
  "howto",
  "sports",
  "other",
];

export async function getAvailableGenreIds(): Promise<GenreId[]> {
  if (availableGenresCache && Date.now() < availableGenresCache.expiresAt) {
    return availableGenresCache.ids;
  }

  const available: GenreId[] = [...BASE_AVAILABLE_GENRES];

  try {
    const educationItems = await getVideoItemsForPeriod("7d", "education");
    if (educationItems.length > 0) {
      available.splice(4, 0, "education");
    }
  } catch {
    // Education is search-only; omit when no results are returned.
  }

  availableGenresCache = {
    ids: available,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return available;
}

export async function getRankingDiscoveryVideoItems(
  maxItems: number = OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert,
): Promise<YouTubeVideoItem[]> {
  const videosById = new Map<string, YouTubeVideoItem>();

  for (const period of OBSERVABILITY_CONFIG.rankingDiscovery.periods) {
    const items = await getVideoItemsForPeriod(period, "all");
    for (const item of items) {
      videosById.set(item.id, item);
    }
  }

  return [...videosById.values()].slice(0, maxItems);
}

export async function getCollectTargetVideoItems(): Promise<YouTubeVideoItem[]> {
  const videosById = new Map<string, YouTubeVideoItem>();

  for (const { id: period } of RANKING_PERIODS) {
    const items = await getVideoItemsForPeriod(period, "all");
    for (const item of items) {
      videosById.set(item.id, item);
    }
  }

  return [...videosById.values()];
}

export async function getRankingCandidates(
  period: RankingPeriod,
  genre: GenreId,
  contentFormat: RankingContentFormat = "regular",
): Promise<Video[]> {
  const videoItems = await getVideoItemsForPeriod(period, genre);
  const filteredItems = filterYouTubeItemsByRankingContentFormat(
    videoItems,
    contentFormat,
  );
  return mapRankingCandidates(filteredItems, period);
}

export async function getRankings(
  period: RankingPeriod,
  genre: GenreId,
): Promise<Video[]> {
  const videoItems = await getVideoItemsForPeriod(period, genre);
  return enrichVideos(videoItems, period);
}

export async function getVideoById(
  id: string,
  period: RankingPeriod = "24h",
): Promise<Video | null> {
  const response = await youtubeFetch<YouTubeVideosResponse>("videos", {
    part: YOUTUBE_VIDEO_DETAILS_PARTS,
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
  const [video] = await finalizeRankedVideos(mapped, period);

  return video ?? null;
}

export function getRankingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "ランキングデータの取得に失敗しました。";
}
