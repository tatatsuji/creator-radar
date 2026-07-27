#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DiscoveryRecallGroundTruth } from "../src/lib/discovery/discoveryRecallGroundTruth";
import { measureDiscoveryRecall } from "../src/lib/discovery/discoveryRecallMeasure";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const groundTruthPath =
  process.env.GROUND_TRUTH_PATH ??
  resolve(projectRoot, ".validation/discovery-recall-ground-truth.json");

async function main(): Promise<void> {
  const groundTruth = JSON.parse(
    readFileSync(groundTruthPath, "utf8"),
  ) as DiscoveryRecallGroundTruth;

  const result = await measureDiscoveryRecall(groundTruth);
  const outputPath = resolve(projectRoot, ".validation/discovery-recall-report.json");
  writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(
    JSON.stringify(
      {
        audit: "discovery-recall",
        groundTruthPath,
        reportPath: outputPath,
        groundTruthCount: result.groundTruthCount,
        discoveredCount: result.discoveredCount,
        recall: result.recall,
        recallPercent: result.recallPercent,
        missedCount: result.missedCount,
        overallRecall: result.overallRecall,
        mainstreamBuzzRecall: result.mainstreamBuzzRecall,
        emergingCreatorRecall: result.emergingCreatorRecall,
        shortFormRecall: result.shortFormRecall,
        liveRecall: result.liveRecall,
        byFirstSource: result.byFirstSource,
        byAllSources: result.byAllSources,
        byCategory: result.byCategory,
        sets: result.sets,
        latency: result.latency,
        missedSample: result.missedVideoIds.slice(0, 10),
        discoveredSample: result.videos
          .filter((video) => video.discovered)
          .slice(0, 5)
          .map((video) => ({
            videoId: video.videoId,
            title: video.title.slice(0, 50),
            hoursToDiscovery: video.hoursToDiscovery,
            firstSource: video.firstSource,
          })),
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
