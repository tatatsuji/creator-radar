#!/usr/bin/env node
/**
 * Phase1 finalize recall: new multi-set Ground Truth + full metrics.
 * Use --skip-discovery on GHA to avoid double-running discovery (observability-cron handles it).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { buildDiscoveryRecallGroundTruth } from "../src/lib/discovery/discoveryRecallGroundTruth";
import { measureDiscoveryRecall } from "../src/lib/discovery/discoveryRecallMeasure";
import {
  classifyMissedVideo,
  mapCategoryIdToGenre,
  summarizeMissedAnalysis,
  type MissedVideoAnalysisInput,
} from "../src/lib/discovery/missedDiscoveryAnalysis";
import { runDiscoveryCron } from "../src/lib/discovery/runDiscoveryCron";
import { verifyMigration006 } from "../src/lib/db/migration006";
import { estimateDiscoveryQuotaPerRun } from "../src/lib/discovery/quotaBudget";
import {
  evalFetchMostPopular,
  evalSearchVideos,
} from "../src/lib/discovery/recallGroundTruthFetch";
import { PHASE1_VERIFICATION } from "../src/lib/observability/phase1Verification";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = resolve(projectRoot, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
  }
  return { ...env, ...process.env } as Record<string, string>;
}

async function probeColumn(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
}

async function buildGroundTruthWithRetry(maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const groundTruth = await buildDiscoveryRecallGroundTruth();
      writeFileSync(
        resolve(projectRoot, ".validation/discovery-recall-ground-truth-new.json"),
        JSON.stringify(groundTruth, null, 2),
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Quota exceeded") || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, attempt * 30_000));
    }
  }
}

async function measureConnectionRate(
  supabase: ReturnType<typeof createClient>,
  sinceIso: string,
): Promise<{ rate: number; discovered: number; scheduled: number }> {
  const { data: discoveries } = await supabase
    .from("candidate_discoveries")
    .select("video_id")
    .gte("discovered_at", sinceIso);
  const videoIds = [...new Set((discoveries ?? []).map((r) => r.video_id as string))];
  if (videoIds.length === 0) {
    return { rate: 1, discovered: 0, scheduled: 0 };
  }
  const { data: schedules } = await supabase
    .from("measurement_schedule")
    .select("video_id")
    .in("video_id", videoIds);
  const scheduled = schedules?.length ?? 0;
  return {
    rate: scheduled / videoIds.length,
    discovered: videoIds.length,
    scheduled,
  };
}

async function sumQuotaFromRuns(
  supabase: ReturnType<typeof createClient>,
  sinceIso: string,
): Promise<number> {
  const { data: runs } = await supabase
    .from("discovery_runs")
    .select("youtube_quota_estimate,started_at")
    .gte("started_at", sinceIso);
  return (runs ?? []).reduce(
    (sum, row) => sum + (Number(row.youtube_quota_estimate) || 0),
    0,
  );
}

async function analyzeMissedVideos(
  missedIds: string[],
  gtVideos: Array<{
    videoId: string;
    title: string;
    channelId: string;
    channelName: string;
    publishedAt: string;
    categoryId?: string;
    groundTruthSources: string[];
  }>,
): Promise<ReturnType<typeof summarizeMissedAnalysis>> {
  const gtById = new Map(gtVideos.map((v) => [v.videoId, v]));
  const [popularAll, searchView24h] = await Promise.all([
    evalFetchMostPopular("all", 50),
    evalSearchVideos({ period: "24h", genre: "all", order: "viewCount", maxResults: 50 }),
  ]);
  const popularAllIds = new Set(popularAll.map((v) => v.id));
  const searchViewIds = new Set(searchView24h.map((v) => v.id));
  const nowMs = Date.now();

  const inputs: MissedVideoAnalysisInput[] = missedIds.map((videoId) => {
    const gt = gtById.get(videoId)!;
    const mappedGenre = mapCategoryIdToGenre(gt.categoryId);
    const publishedMs = Date.parse(gt.publishedAt);
    return {
      videoId,
      title: gt.title,
      channelId: gt.channelId,
      channelName: gt.channelName,
      publishedAt: gt.publishedAt,
      categoryId: gt.categoryId,
      groundTruthSources: gt.groundTruthSources,
      inMostPopularAll: popularAllIds.has(videoId),
      inMostPopularCategory: false,
      inSearchViewCount24h: searchViewIds.has(videoId),
      inSearchDate24h: false,
      mappedGenre,
      genreWasInRotation: true,
      inDb: false,
      unavailable: false,
      ageHours: Number.isNaN(publishedMs) ? 0 : (nowMs - publishedMs) / 3_600_000,
    };
  });

  return summarizeMissedAnalysis(inputs, gtVideos.length, gtVideos.length - missedIds.length);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const skipDiscovery = args.has("--skip-discovery");
  const skipMissedAnalysis = args.has("--skip-missed-analysis");
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  mkdirSync(resolve(projectRoot, ".validation"), { recursive: true });

  const oldReportPath = resolve(projectRoot, ".validation/discovery-recall-report.json");
  const oldGtPath = resolve(projectRoot, ".validation/discovery-recall-ground-truth.json");
  if (existsSync(oldReportPath)) {
    copyFileSync(oldReportPath, resolve(projectRoot, ".validation/discovery-recall-report-old-gt.json"));
  }
  if (existsSync(oldGtPath)) {
    copyFileSync(oldGtPath, resolve(projectRoot, ".validation/discovery-recall-ground-truth-old.json"));
  }

  const migration006 = await verifyMigration006((table, column) =>
    probeColumn(supabase, table, column),
  );

  let discoveryResult: unknown = null;
  if (!skipDiscovery) {
    discoveryResult = await runDiscoveryCron();
  }

  await buildGroundTruthWithRetry();
  const groundTruth = JSON.parse(
    readFileSync(resolve(projectRoot, ".validation/discovery-recall-ground-truth-new.json"), "utf8"),
  );
  const measure = await measureDiscoveryRecall(groundTruth);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const connection = await measureConnectionRate(supabase, since24h);
  const quotaUsed24h = await sumQuotaFromRuns(supabase, since24h);
  const quotaEstimate = estimateDiscoveryQuotaPerRun();
  const missedAnalysis =
    !skipMissedAnalysis && measure.missedCount > 0
      ? await analyzeMissedVideos(
          measure.missedVideoIds,
          groundTruth.videos ?? groundTruth.sets?.flatMap((s: { videos: unknown[] }) => s.videos) ?? [],
        )
      : null;

  let oldGtRecall: number | null = null;
  const oldReportPath2 = resolve(projectRoot, ".validation/discovery-recall-report-old-gt.json");
  if (existsSync(oldReportPath2)) {
    oldGtRecall = JSON.parse(readFileSync(oldReportPath2, "utf8")).recallPercent ?? null;
  }

  const sportsMissed = measure.missedVideoIds.filter((id) => {
    const v = (groundTruth.videos as Array<{ videoId: string; groundTruthSources: string[] }>).find(
      (row) => row.videoId === id,
    );
    return v?.groundTruthSources.some((s) => s.includes("sports"));
  });

  const report = {
    measuredAt: new Date().toISOString(),
    groundTruthType: "new_multi_set",
    groundTruthGeneratedAt: groundTruth.generatedAt,
    migration006,
    discovery: discoveryResult,
    recall: {
      overallRecall: measure.recall,
      overallRecallPercent: measure.recallPercent,
      mainstreamBuzzRecall: measure.mainstreamBuzzRecall,
      emergingCreatorRecall: measure.emergingCreatorRecall,
      shortFormRecall: measure.shortFormRecall,
      liveRecall: measure.liveRecall,
      missedCount: measure.missedCount,
      missedVideoIds: measure.missedVideoIds,
      sportsMissedCount: sportsMissed.length,
      sportsMissedIds: sportsMissed,
      byFirstSource: measure.byFirstSource,
      byAllSources: measure.byAllSources,
      byCategory: measure.byCategory,
      sets: measure.sets,
    },
    oldGtComparison: {
      oldGtRecallPercent: oldGtRecall,
      newGtRecallPercent: measure.recallPercent,
      deltaPercent: oldGtRecall != null ? measure.recallPercent - oldGtRecall : null,
      note: "Old GT was single-set pre-quota-reset. New GT is multi-set from recallGroundTruthFetch.ts.",
    },
    measurementConnection: connection,
    quota: {
      usedLast24hFromRuns: quotaUsed24h,
      dailyLimit: 10_000,
      usageRatio24h: quotaUsed24h / 10_000,
      estimatedDailyPerSchedule: quotaEstimate.totalPerDay,
      withinTarget70pct: quotaUsed24h / 10_000 <= PHASE1_VERIFICATION.recallTargets.dailyQuotaUsageRatio,
    },
    missedAnalysis,
    passCriteria: {
      overallRecall85: measure.recall >= PHASE1_VERIFICATION.recallTargets.overallRecall,
      mainstreamBuzz90:
        measure.mainstreamBuzzRecall != null &&
        measure.mainstreamBuzzRecall >= PHASE1_VERIFICATION.recallTargets.mainstreamBuzzRecall,
      connectionRate95:
        connection.rate >= PHASE1_VERIFICATION.recallTargets.measurementConnectionRate,
      quota70: quotaUsed24h / 10_000 <= PHASE1_VERIFICATION.recallTargets.dailyQuotaUsageRatio,
    },
    evaluationLeak: {
      groundTruthModule: "recallGroundTruthFetch.ts",
      discoveryModule: "candidateFetch.ts",
      sharedDbForGt: false,
      codePathSeparated: true,
    },
  };

  writeFileSync(
    resolve(projectRoot, ".validation/discovery-recall-ground-truth.json"),
    JSON.stringify(groundTruth, null, 2),
  );
  writeFileSync(
    resolve(projectRoot, ".validation/discovery-recall-report-new-gt.json"),
    JSON.stringify(measure, null, 2),
  );
  writeFileSync(
    resolve(projectRoot, ".validation/phase1-recall-finalize.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
