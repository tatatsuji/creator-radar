#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditBuzzTop100 } from "../src/lib/ranking/buzzRankingQuality";
import { buildRankings } from "../src/lib/ranking/buildRankings";
import {
  MAX_BUZZ_RANKING_RESULTS,
  MIN_BUZZ_RANKING_TARGET,
} from "../src/lib/ranking/rankingMeta";
import { getSnapshotMetricsSummary } from "../src/lib/ranking/snapshotMetrics";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvFile(path: string): void {
  const fullPath = resolve(projectRoot, path);
  if (!existsSync(fullPath)) return;
  for (const line of readFileSync(fullPath, "utf8").split(/\r?\n/)) {
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

  const period = process.env.AUDIT_PERIOD ?? "24h";
  const genre = process.env.AUDIT_GENRE ?? "all";
  const baseUrl = process.env.AUDIT_BASE_URL;

  let videos;
  let source: "api" | "direct" = "direct";

  if (baseUrl) {
    source = "api";
    const response = await fetch(
      `${baseUrl}/api/rankings?ranking=buzz&period=${period}&genre=${genre}`,
    );
    const body = (await response.json()) as { videos?: typeof videos; error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? `API failed: ${response.status}`);
    }
    videos = body.videos ?? [];
  } else {
    const built = await buildRankings("buzz", period as "24h", genre as "all");
    videos = built.videos;
  }

  const top100 = videos.slice(0, MAX_BUZZ_RANKING_RESULTS);
  const audit = auditBuzzTop100(videos);
  const summary = getSnapshotMetricsSummary(top100);

  const channelCounts = new Map<string, number>();
  for (const video of top100) {
    channelCounts.set(video.channel.id, (channelCounts.get(video.channel.id) ?? 0) + 1);
  }
  const channelsOverCap = [...channelCounts.entries()].filter(([, count]) => count > 5);

  const payload = {
        audit: "buzz-top100",
        source,
        period,
        genre,
        displayCount: top100.length,
        minTarget: MIN_BUZZ_RANKING_TARGET,
        maxTarget: MAX_BUZZ_RANKING_RESULTS,
        meetsMinTarget: top100.length >= MIN_BUZZ_RANKING_TARGET,
        meetsIdealTarget: top100.length >= MAX_BUZZ_RANKING_RESULTS,
        measuredRate: Number(audit.measuredRate.toFixed(4)),
        measuredRateGoalMet: audit.measuredRate >= 0.8,
        estimatedRate: Number((1 - audit.measuredRate).toFixed(4)),
        uniqueChannelCount: audit.uniqueChannelCount,
        uniqueChannelGoalMet: audit.uniqueChannelCount >= 50,
        metricsSummary: summary,
        scoreZeroCount: audit.scoreZeroCount,
        nonPositiveVelocityCount: audit.nonPositiveVelocityCount,
        categoryDistribution: audit.categoryDistribution,
        classificationDistribution: audit.classificationDistribution,
        channelsOverCap,
        maxPerChannel: Math.max(0, ...channelCounts.values()),
        top100VideoIds: top100.map((video) => video.id),
        completionGoals: {
          displayRangeMet:
            top100.length >= MIN_BUZZ_RANKING_TARGET &&
            top100.length <= MAX_BUZZ_RANKING_RESULTS,
          idealDisplayMet: top100.length === MAX_BUZZ_RANKING_RESULTS,
          measuredRate80Plus: audit.measuredRate >= 0.8,
          uniqueChannels50Plus: audit.uniqueChannelCount >= 50,
          scoreZeroDisplay: audit.scoreZeroCount === 0,
        },
      };

  const validationDir = resolve(projectRoot, ".validation");
  mkdirSync(validationDir, { recursive: true });
  writeFileSync(
    resolve(projectRoot, ".validation/buzz-top100-audit.json"),
    JSON.stringify(payload, null, 2),
  );
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
