#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDiscoveryRecallGroundTruth } from "../src/lib/discovery/discoveryRecallGroundTruth";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const outputPath =
  process.env.GROUND_TRUTH_PATH ??
  resolve(projectRoot, ".validation/discovery-recall-ground-truth.json");

async function main(): Promise<void> {
  const groundTruth = await buildDiscoveryRecallGroundTruth();
  mkdirSync(resolve(projectRoot, ".validation"), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(groundTruth, null, 2));
  console.log(
    JSON.stringify(
      {
        status: "built",
        outputPath,
        actualCount: groundTruth.actualCount,
        targetCount: groundTruth.targetCount,
        fetchSummary: groundTruth.fetchSummary,
        top5: groundTruth.videos.slice(0, 5).map((video) => ({
          videoId: video.videoId,
          title: video.title.slice(0, 60),
          viewCount: video.viewCount,
          buzzScore: Math.round(video.buzzScore * 10) / 10,
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
