import { getPeriodHours } from "@/lib/ranking/periods";
import {
  genreSupportsPopularChart,
} from "@/lib/youtube/categories";
import { parseCount } from "@/lib/youtube/helpers";
import type { GenreId } from "@/types";
import type { YouTubeVideoItem } from "@/lib/youtube/types";
import {
  evalFetchChannelSubscribers,
  evalFetchLiveCandidates,
  evalFetchMostPopular,
  evalFetchShortFormCandidates,
  evalSearchVideos,
} from "@/lib/discovery/recallGroundTruthFetch";

export const DISCOVERY_RECALL_GROUND_TRUTH_SIZE = 100;
export const DISCOVERY_RECALL_GROUND_TRUTH_REGION = "JP" as const;

export type GroundTruthSetId =
  | "mainstream_buzz"
  | "emerging_creator"
  | "short_form"
  | "live";

export interface GroundTruthVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  publishedAt: string;
  viewCount: number;
  categoryId?: string;
  buzzScore: number;
  groundTruthSources: string[];
  groundTruthSet: GroundTruthSetId;
  subscriberCount?: number;
}

export interface DiscoveryRecallGroundTruthSet {
  setId: GroundTruthSetId;
  definition: string;
  limitations?: string;
  targetCount: number;
  actualCount: number;
  fetchSummary: Record<string, number>;
  videos: GroundTruthVideo[];
}

export interface DiscoveryRecallGroundTruth {
  generatedAt: string;
  region: typeof DISCOVERY_RECALL_GROUND_TRUTH_REGION;
  definition: string;
  targetCount: number;
  actualCount: number;
  fetchSummary: Record<string, number>;
  videos: GroundTruthVideo[];
  sets: DiscoveryRecallGroundTruthSet[];
}

const GROUND_TRUTH_GENRES: GenreId[] = [
  "entertainment",
  "music",
  "game",
  "news",
  "howto",
  "sports",
];

const EMERGING_CREATOR_MAX_SUBSCRIBERS = 100_000;
const EMERGING_CREATOR_MAX_AGE_HOURS = 72;

function computeBuzzScore(item: YouTubeVideoItem, nowMs: number): number {
  const viewCount = parseCount(item.statistics?.viewCount);
  const publishedMs = Date.parse(item.snippet.publishedAt);
  const ageHours = Math.max(1, (nowMs - publishedMs) / (60 * 60 * 1000));
  const cappedAgeHours = Math.min(ageHours, getPeriodHours("7d"));
  const velocity = viewCount / cappedAgeHours;

  return Math.log10(viewCount + 1) * 45 + Math.log10(velocity + 1) * 55;
}

function isEligibleGroundTruthItem(item: YouTubeVideoItem, nowMs: number): boolean {
  const publishedMs = Date.parse(item.snippet.publishedAt);
  if (Number.isNaN(publishedMs)) {
    return false;
  }

  const maxAgeMs = getPeriodHours("7d") * 60 * 60 * 1000;
  if (nowMs - publishedMs > maxAgeMs) {
    return false;
  }

  const viewCount = parseCount(item.statistics?.viewCount);
  if (viewCount <= 0) {
    return false;
  }

  return Boolean(item.id && item.snippet.channelId);
}

function toGroundTruthVideo(
  item: YouTubeVideoItem,
  sourceLabel: string,
  setId: GroundTruthSetId,
  nowMs: number,
  subscriberCount?: number,
): GroundTruthVideo {
  return {
    videoId: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelName: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    viewCount: parseCount(item.statistics?.viewCount),
    categoryId: item.snippet.categoryId,
    buzzScore: computeBuzzScore(item, nowMs),
    groundTruthSources: [sourceLabel],
    groundTruthSet: setId,
    subscriberCount,
  };
}

function mergeGroundTruthVideos(
  target: Map<string, GroundTruthVideo>,
  items: YouTubeVideoItem[],
  sourceLabel: string,
  setId: GroundTruthSetId,
  nowMs: number,
  subscriberCounts?: Map<string, number>,
): void {
  for (const item of items) {
    if (!isEligibleGroundTruthItem(item, nowMs)) {
      continue;
    }

    const subscriberCount = subscriberCounts?.get(item.snippet.channelId);
    const existing = target.get(item.id);
    if (existing) {
      if (!existing.groundTruthSources.includes(sourceLabel)) {
        existing.groundTruthSources.push(sourceLabel);
      }
      const nextScore = computeBuzzScore(item, nowMs);
      if (nextScore > existing.buzzScore) {
        existing.buzzScore = nextScore;
        existing.viewCount = parseCount(item.statistics?.viewCount);
      }
      continue;
    }

    target.set(
      item.id,
      toGroundTruthVideo(item, sourceLabel, setId, nowMs, subscriberCount),
    );
  }
}

function rankAndSlice(
  merged: Map<string, GroundTruthVideo>,
  targetCount: number,
): GroundTruthVideo[] {
  return [...merged.values()]
    .sort((left, right) => {
      const scoreDiff = right.buzzScore - left.buzzScore;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return right.viewCount - left.viewCount;
    })
    .slice(0, targetCount);
}

async function buildMainstreamBuzzSet(
  targetCount: number,
  nowMs: number,
): Promise<DiscoveryRecallGroundTruthSet> {
  const fetchSummary: Record<string, number> = {};
  const merged = new Map<string, GroundTruthVideo>();

  const popularAll = await evalFetchMostPopular("all", 50);
  fetchSummary["most_popular:all"] = popularAll.length;
  mergeGroundTruthVideos(merged, popularAll, "most_popular:all", "mainstream_buzz", nowMs);

  for (const period of ["24h", "7d"] as const) {
    const byViews = await evalSearchVideos({
      period,
      genre: "all",
      order: "viewCount",
      maxResults: 50,
    });
    const label = `search:viewCount:${period}`;
    fetchSummary[label] = byViews.length;
    mergeGroundTruthVideos(merged, byViews, label, "mainstream_buzz", nowMs);
  }

  for (const genre of GROUND_TRUTH_GENRES) {
    if (genreSupportsPopularChart(genre)) {
      const popular = await evalFetchMostPopular(genre, 25);
      const label = `most_popular:${genre}`;
      fetchSummary[label] = popular.length;
      mergeGroundTruthVideos(merged, popular, label, "mainstream_buzz", nowMs);
    }
  }

  const videos = rankAndSlice(merged, targetCount);

  return {
    setId: "mainstream_buzz",
    definition:
      "JP mainstream buzz: mostPopular (overall + category) and high-view search within 7 days.",
    targetCount,
    actualCount: videos.length,
    fetchSummary,
    videos,
  };
}

async function buildEmergingCreatorSet(
  targetCount: number,
  nowMs: number,
): Promise<DiscoveryRecallGroundTruthSet> {
  const fetchSummary: Record<string, number> = {};
  const merged = new Map<string, GroundTruthVideo>();

  const candidates = await evalSearchVideos({
    period: "3d",
    genre: "all",
    order: "viewCount",
    maxResults: 100,
  });
  fetchSummary["search:viewCount:72h"] = candidates.length;

  const channelIds = [...new Set(candidates.map((item) => item.snippet.channelId))];
  const subscribers = await evalFetchChannelSubscribers(channelIds);
  fetchSummary["channels:list"] = Math.ceil(channelIds.length / 50);

  for (const item of candidates) {
    const publishedMs = Date.parse(item.snippet.publishedAt);
    const ageHours = (nowMs - publishedMs) / (60 * 60 * 1000);
    if (ageHours > EMERGING_CREATOR_MAX_AGE_HOURS) {
      continue;
    }

    const subs = subscribers.get(item.snippet.channelId) ?? Number.MAX_SAFE_INTEGER;
    if (subs >= EMERGING_CREATOR_MAX_SUBSCRIBERS) {
      continue;
    }

    const viewCount = parseCount(item.statistics?.viewCount);
    const velocity = viewCount / Math.max(1, ageHours);
    if (velocity < 500) {
      continue;
    }

    mergeGroundTruthVideos(
      merged,
      [item],
      "emerging:velocity",
      "emerging_creator",
      nowMs,
      subscribers,
    );
  }

  const videos = rankAndSlice(merged, targetCount);

  return {
    setId: "emerging_creator",
    definition:
      "JP emerging creators: <100k subscribers, published ≤72h, high view velocity from independent search.",
    targetCount,
    actualCount: videos.length,
    fetchSummary,
    videos,
  };
}

async function buildShortFormSet(
  targetCount: number,
  nowMs: number,
): Promise<DiscoveryRecallGroundTruthSet> {
  const fetchSummary: Record<string, number> = {};
  const merged = new Map<string, GroundTruthVideo>();

  const shorts = await evalFetchShortFormCandidates("24h", 50);
  fetchSummary["short_form:viewCount:24h"] = shorts.length;
  mergeGroundTruthVideos(merged, shorts, "short_form:viewCount:24h", "short_form", nowMs);

  const videos = rankAndSlice(merged, targetCount);

  return {
    setId: "short_form",
    definition:
      "JP short-form candidates via videoDuration=short (≤4 min). Not guaranteed vertical Shorts.",
    limitations:
      "YouTube search.list videoDuration=short does not distinguish vertical Shorts from short regular videos.",
    targetCount,
    actualCount: videos.length,
    fetchSummary,
    videos,
  };
}

async function buildLiveSet(
  targetCount: number,
  nowMs: number,
): Promise<DiscoveryRecallGroundTruthSet> {
  const fetchSummary: Record<string, number> = {};
  const merged = new Map<string, GroundTruthVideo>();

  const live = await evalFetchLiveCandidates(50);
  fetchSummary["live:live+completed"] = live.length;
  mergeGroundTruthVideos(merged, live, "live:live+completed", "live", nowMs);

  const videos = rankAndSlice(merged, targetCount);

  return {
    setId: "live",
    definition:
      "JP live candidates: currently live + recently completed streams (72h window).",
    limitations:
      "Live ground truth depends on broadcast timing; 0 results may be normal when no major streams are active.",
    targetCount,
    actualCount: videos.length,
    fetchSummary,
    videos,
  };
}

export async function buildDiscoveryRecallGroundTruth(input?: {
  targetCount?: number;
  now?: Date;
}): Promise<DiscoveryRecallGroundTruth> {
  const targetCount = input?.targetCount ?? DISCOVERY_RECALL_GROUND_TRUTH_SIZE;
  const nowMs = (input?.now ?? new Date()).getTime();

  const [mainstream, emerging, shortForm, live] = await Promise.all([
    buildMainstreamBuzzSet(targetCount, nowMs),
    buildEmergingCreatorSet(Math.min(50, targetCount), nowMs),
    buildShortFormSet(Math.min(30, targetCount), nowMs),
    buildLiveSet(Math.min(20, targetCount), nowMs),
  ]);

  const sets = [mainstream, emerging, shortForm, live];
  const fetchSummary: Record<string, number> = {};
  for (const set of sets) {
    for (const [key, value] of Object.entries(set.fetchSummary)) {
      fetchSummary[`${set.setId}:${key}`] = value;
    }
  }

  const overallMerged = new Map<string, GroundTruthVideo>();
  for (const set of sets) {
    for (const video of set.videos) {
      const existing = overallMerged.get(video.videoId);
      if (existing) {
        for (const source of video.groundTruthSources) {
          if (!existing.groundTruthSources.includes(source)) {
            existing.groundTruthSources.push(source);
          }
        }
        if (video.buzzScore > existing.buzzScore) {
          existing.buzzScore = video.buzzScore;
        }
        continue;
      }
      overallMerged.set(video.videoId, { ...video });
    }
  }

  const videos = rankAndSlice(overallMerged, targetCount);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    region: DISCOVERY_RECALL_GROUND_TRUTH_REGION,
    definition:
      "Multi-set JP ground truth: mainstream buzz (primary), emerging creators, short-form, live.",
    targetCount,
    actualCount: videos.length,
    fetchSummary,
    videos,
    sets,
  };
}

export function getGroundTruthVideoIds(
  groundTruth: DiscoveryRecallGroundTruth,
): string[] {
  return groundTruth.videos.map((video) => video.videoId);
}
