#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { registerBuzzCandidatesFromYouTubeItems } from "../src/lib/discovery/buzzCandidateRegistration";
import { countCandidateDiscoveries } from "../src/lib/discovery/repository";
import { analyzeBuzzSnapshotDistribution } from "../src/lib/ranking/buzzMeasuredDiagnostics";
import { buildRankings } from "../src/lib/ranking/buildRankings";
import { getSnapshotMetricsSummary } from "../src/lib/ranking/snapshotMetrics";
import { countMeasurementSchedules } from "../src/lib/measurement/scheduleRepository";
import { estimateRankingDiscoveryQuotaUnits } from "../src/lib/observability/quotaEstimates";
import { OBSERVABILITY_CONFIG } from "../src/lib/observability/config";
import {
  countDistinctVideosWithSnapshots,
  findExistingVideoIds,
} from "../src/lib/snapshots/repository";
import { isSupabaseConfigured } from "../src/lib/supabase/server";
import { getRankingDiscoveryVideoItems } from "../src/lib/youtube/rankings";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvFile(path: string): void {
  for (const line of readFileSync(resolve(projectRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local");

  if (!process.env.YOUTUBE_API_KEY?.trim()) {
    throw new Error("YOUTUBE_API_KEY missing in .env.local");
  }

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const candidateItems = await getRankingDiscoveryVideoItems(
    OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert,
  );
  const candidateIds = candidateItems.map((item) => item.id);
  const existingBefore = await findExistingVideoIds(candidateIds);
  const overlapBefore = candidateIds.filter((id) => existingBefore.has(id)).length;

  const registration = await registerBuzzCandidatesFromYouTubeItems(candidateItems, {
    period: "24h",
    genre: "all",
  });

  const existingAfter = await findExistingVideoIds(candidateIds);
  const duplicateRows = candidateIds.filter((id) => {
    const existedBefore = existingBefore.has(id);
    return existedBefore && registration.videosInserted > 0;
  }).length;

  const buzz = await buildRankings("buzz", "24h", "all");
  const summary = getSnapshotMetricsSummary(buzz.videos);
  const totalCandidates = buzz.videos.length;
  const coverageRate =
    totalCandidates > 0
      ? Math.round((summary.measured / totalCandidates) * 100)
      : 0;

  const snapshotDistribution = await analyzeBuzzSnapshotDistribution({
    videoIds: candidateIds,
    period: "24h",
  });

  const schedulesTotal = await countMeasurementSchedules();
  const discoveriesTotal = await countCandidateDiscoveries();
  const snapshotVideos = await countDistinctVideosWithSnapshots();

  const quotaEstimate = estimateRankingDiscoveryQuotaUnits({
    videoCount: candidateItems.length,
    channelCount: new Set(candidateItems.map((item) => item.snippet.channelId)).size,
    searchCalls: OBSERVABILITY_CONFIG.rankingDiscovery.searchCallsPerRun,
  });

  console.log(
    JSON.stringify(
      {
        youtubeCandidateCount: candidateItems.length,
        videosInserted: registration.videosInserted,
        videosUpdated: registration.videosUpdated,
        measurementSchedulesCreated: registration.schedulesCreated,
        measurementSchedulesExisting: registration.schedulesExisting,
        candidateSnapshotOverlapBeforeRun: overlapBefore,
        duplicateRegistration:
          duplicateRows > registration.videosUpdated ? "unexpected" : "none",
        existingCandidatesAfterRegistration: existingAfter.size,
        buzzRankingMeasuredCount: summary.measured,
        buzzRankingEstimatedCount: summary.estimated,
        measuredCoverageRatePercent: coverageRate,
        snapshotDistribution,
        usedYouTubeFallbackForRanking: buzz.usedYouTubeFallback ?? false,
        measurementSchedulesTotal: schedulesTotal,
        candidateDiscoveriesTotal: discoveriesTotal,
        distinctSnapshotVideosTotal: snapshotVideos,
        registrationFailures: registration.failures,
        rankingDiscoveryQuotaEstimateUnits: quotaEstimate,
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
