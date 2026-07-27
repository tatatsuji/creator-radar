#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { OBSERVABILITY_CONFIG } from "../src/lib/observability/config";
import {
  estimateSearchQuotaUnits,
  estimateVideosListQuotaUnits,
} from "../src/lib/youtube/candidateFetch";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

const env = loadEnvFile(resolve(projectRoot, ".env.local"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function estimateDailyQuotaPerRun(): number {
  const genresPerRun = OBSERVABILITY_CONFIG.phase1Discovery.genresPerRun;
  const perCategory =
    estimateSearchQuotaUnits(2) +
    estimateVideosListQuotaUnits(
      OBSERVABILITY_CONFIG.phase1Discovery.maxResultsPerCategorySource,
    );
  const categoryTotal = perCategory * genresPerRun;
  const shorts =
    estimateSearchQuotaUnits(1) +
    estimateVideosListQuotaUnits(
      OBSERVABILITY_CONFIG.phase1Discovery.shortsMaxResults,
    );
  const live =
    estimateSearchQuotaUnits(1) +
    estimateVideosListQuotaUnits(
      OBSERVABILITY_CONFIG.phase1Discovery.liveMaxResults,
    );
  const ranking =
    estimateSearchQuotaUnits(
      OBSERVABILITY_CONFIG.rankingDiscovery.searchCallsPerRun *
        OBSERVABILITY_CONFIG.rankingDiscovery.periods.length,
    ) + estimateVideosListQuotaUnits(100);
  const popular = estimateVideosListQuotaUnits(30);
  const watchlist =
    OBSERVABILITY_CONFIG.batchSize.watchlistCheck *
    3;

  return categoryTotal + shorts + live + ranking + popular + watchlist;
}

async function main(): Promise<void> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: sourceRows, error: sourceError } = await supabase
    .from("candidate_discoveries")
    .select("source_type,video_id")
    .gte("discovered_at", since24h);

  if (sourceError) {
    throw new Error(`candidate_discoveries query failed: ${sourceError.message}`);
  }

  const sourceCounts = new Map<string, number>();
  for (const row of sourceRows ?? []) {
    const key = row.source_type as string;
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }

  const { count: videoCount, error: videoError } = await supabase
    .from("videos")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  if (videoError) {
    throw new Error(`videos count failed: ${videoError.message}`);
  }

  const { data: typedVideos, error: typedError } = await supabase
    .from("videos")
    .select("is_short,is_live,content_features")
    .eq("is_active", true);

  if (typedError) {
    throw new Error(`videos typed query failed: ${typedError.message}`);
  }

  const shortsCount = (typedVideos ?? []).filter((row) => row.is_short === true).length;
  const liveCount = (typedVideos ?? []).filter((row) => row.is_live === true).length;
  const regularCount = (typedVideos ?? []).filter(
    (row) => row.is_short !== true && row.is_live !== true,
  ).length;
  const withFeatures = (typedVideos ?? []).filter(
    (row) => row.content_features !== null,
  ).length;

  const totalDiscoveries = sourceRows?.length ?? 0;
  const uniqueVideos = new Set(
    (sourceRows ?? []).map((row) => row.video_id as string),
  ).size;
  const duplicateRate =
    totalDiscoveries > 0
      ? Number(((totalDiscoveries - uniqueVideos) / totalDiscoveries).toFixed(4))
      : 0;

  const { data: recentRuns } = await supabase
    .from("discovery_runs")
    .select("run_type,status,youtube_quota_estimate,metadata,started_at")
    .gte("started_at", since24h)
    .order("started_at", { ascending: false })
    .limit(5);

  console.log(
    JSON.stringify(
      {
        phase: "Phase1 candidate discovery audit",
        generatedAt: new Date().toISOString(),
        config: {
          categoryGenres: OBSERVABILITY_CONFIG.phase1Discovery.categoryGenres,
          genresPerRun: OBSERVABILITY_CONFIG.phase1Discovery.genresPerRun,
          maxResultsPerCategorySource:
            OBSERVABILITY_CONFIG.phase1Discovery.maxResultsPerCategorySource,
          shortsMaxResults: OBSERVABILITY_CONFIG.phase1Discovery.shortsMaxResults,
          liveMaxResults: OBSERVABILITY_CONFIG.phase1Discovery.liveMaxResults,
          dbRemeasureLimit: OBSERVABILITY_CONFIG.phase1Discovery.dbRemeasureLimit,
          watchlistBatch: OBSERVABILITY_CONFIG.batchSize.watchlistCheck,
        },
        candidateSourcesLast24h: Object.fromEntries(sourceCounts),
        categoryCount: OBSERVABILITY_CONFIG.phase1Discovery.categoryGenres.length,
        activeVideoCount: videoCount ?? 0,
        contentKindCounts: {
          shorts: shortsCount,
          live: liveCount,
          regular: regularCount,
          unknown: (typedVideos?.length ?? 0) - shortsCount - liveCount - regularCount,
        },
        enrichedFeatureRows: withFeatures,
        discoveriesLast24h: totalDiscoveries,
        duplicateRateLast24h: duplicateRate,
        estimatedQuotaPerDiscoveryRun: estimateDailyQuotaPerRun(),
        recentDiscoveryRuns: recentRuns ?? [],
        likelyMissCases: [
          "education genre has no mostPopular chart",
          "channels outside watchlist seed list",
          "videos older than search window without db_remeasure",
          "non-JP region trending content",
        ],
        beforeAfter: {
          before: {
            sources: ["watchlist_upload", "search", "most_popular"],
            dailyCandidateCapVercel: 200,
          },
          after: {
            sources: [
              "watchlist_upload",
              "category_search",
              "search",
              "most_popular",
              "shorts_search",
              "live_search",
              "db_remeasure",
            ],
            estimatedDailyCandidateCapVercel: 400,
          },
        },
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
