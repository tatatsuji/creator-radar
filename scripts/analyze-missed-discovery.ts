#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pickGenresForCategoryFetch, discoveryRunIndex } from "../src/lib/discovery/categoryStrategy";
import type { DiscoveryRecallGroundTruth } from "../src/lib/discovery/discoveryRecallGroundTruth";
import {
  classifyMissedVideo,
  mapCategoryIdToGenre,
  summarizeMissedAnalysis,
  type MissedVideoAnalysisInput,
} from "../src/lib/discovery/missedDiscoveryAnalysis";
import {
  evalFetchMostPopular,
  evalSearchVideos,
} from "../src/lib/discovery/recallGroundTruthFetch";
import { parseIsoDurationSeconds } from "../src/lib/youtube/duration";
import { youtubeFetch } from "../src/lib/youtube/client";
import { getYouTubeCategoryId } from "../src/lib/youtube/categories";
import type { GenreId } from "../src/types";
import type { YouTubeVideosResponse } from "../src/lib/youtube/types";
import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(projectRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function fetchVideoDetails(videoIds: string[]) {
  if (videoIds.length === 0) return [];
  const response = await youtubeFetch<YouTubeVideosResponse>("videos", {
    part: "snippet,contentDetails,statistics",
    id: videoIds.join(","),
  });
  return response.items;
}

function videoIdSet(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

async function main(): Promise<void> {
  const env = loadEnv();
  const reportPath = resolve(projectRoot, ".validation/discovery-recall-report.json");
  const groundTruthPath = resolve(projectRoot, ".validation/discovery-recall-ground-truth.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    missedVideoIds: string[];
    groundTruthCount: number;
    discoveredCount: number;
  };
  const groundTruth = JSON.parse(
    readFileSync(groundTruthPath, "utf8"),
  ) as DiscoveryRecallGroundTruth;

  const missedIds = report.missedVideoIds;
  const gtById = new Map(groundTruth.videos.map((video) => [video.videoId, video]));

  const [popularAll, searchView24h, searchDate24h] = await Promise.all([
    evalFetchMostPopular("all", 50),
    evalSearchVideos({ period: "24h", genre: "all", order: "viewCount", maxResults: 50 }),
    evalSearchVideos({ period: "24h", genre: "all", order: "date", maxResults: 50 }),
  ]);

  const popularAllIds = videoIdSet(popularAll);
  const searchViewIds = videoIdSet(searchView24h);
  const searchDateIds = videoIdSet(searchDate24h);

  const categoryPopularCache = new Map<string, Set<string>>();
  async function getCategoryPopularIds(genre: GenreId): Promise<Set<string>> {
    if (categoryPopularCache.has(genre)) {
      return categoryPopularCache.get(genre)!;
    }
    const items = await evalFetchMostPopular(genre, 25);
    const ids = videoIdSet(items);
    categoryPopularCache.set(genre, ids);
    return ids;
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data: dbVideos } = await supabase
    .from("videos")
    .select("youtube_video_id")
    .in("youtube_video_id", missedIds);

  const inDb = new Set((dbVideos ?? []).map((row) => row.youtube_video_id as string));
  const runGenres = new Set(pickGenresForCategoryFetch(discoveryRunIndex()));
  const nowMs = Date.now();

  const details = await fetchVideoDetails(missedIds);
  const detailById = new Map(details.map((item) => [item.id, item]));

  const analyses: MissedVideoAnalysisInput[] = [];

  for (const videoId of missedIds) {
    const gt = gtById.get(videoId);
    const item = detailById.get(videoId);
    const mappedGenre = mapCategoryIdToGenre(gt?.categoryId);
    const genre: GenreId | null = mappedGenre as GenreId | null;

    let inMostPopularCategory = false;
    if (genre && getYouTubeCategoryId(genre)) {
      const catIds = await getCategoryPopularIds(genre);
      inMostPopularCategory = catIds.has(videoId);
    }

    const publishedMs = gt ? Date.parse(gt.publishedAt) : NaN;
    analyses.push({
      videoId,
      title: gt?.title ?? item?.snippet.title ?? videoId,
      channelId: gt?.channelId ?? item?.snippet.channelId ?? "",
      channelName: gt?.channelName ?? item?.snippet.channelTitle ?? "",
      publishedAt: gt?.publishedAt ?? item?.snippet.publishedAt ?? "",
      categoryId: gt?.categoryId ?? item?.snippet.categoryId,
      durationSeconds: item
        ? parseIsoDurationSeconds(item.contentDetails?.duration)
        : undefined,
      liveBroadcastContent: item?.snippet.liveBroadcastContent,
      groundTruthSources: gt?.groundTruthSources ?? [],
      inMostPopularAll: popularAllIds.has(videoId),
      inMostPopularCategory,
      inSearchViewCount24h: searchViewIds.has(videoId),
      inSearchDate24h: searchDateIds.has(videoId),
      mappedGenre,
      genreWasInRotation: mappedGenre ? runGenres.has(mappedGenre as GenreId) : false,
      inDb: inDb.has(videoId),
      unavailable: !item,
      ageHours: Number.isNaN(publishedMs)
        ? 0
        : (nowMs - publishedMs) / (60 * 60 * 1000),
    });
  }

  const classified = analyses.map(classifyMissedVideo);
  const summary = summarizeMissedAnalysis(
    classified,
    report.groundTruthCount,
    report.discoveredCount,
  );

  const outputPath = resolve(projectRoot, ".validation/missed-discovery-analysis.json");
  writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  console.log(
    JSON.stringify(
      {
        audit: "missed-discovery-analysis",
        outputPath,
        totalMissed: summary.totalMissed,
        byCause: summary.byCause,
        byCausePercent: summary.byCausePercent,
        improvableCount: summary.improvableCount,
        expectedRecallAfterFix: summary.expectedRecallAfterFix,
        improvableWithoutQuotaIncrease: summary.improvableWithoutQuotaIncrease,
        requiresQuotaIncrease: summary.requiresQuotaIncrease,
        rotationGenresThisRun: [...runGenres],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
