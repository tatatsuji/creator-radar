#!/usr/bin/env node
/**
 * Re-measure discovery speed only (no ground truth rebuild).
 * Run 24h after discovery improvements to evaluate latency targets.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DiscoveryRecallGroundTruth } from "../src/lib/discovery/discoveryRecallGroundTruth";
import { measureDiscoveryRecall } from "../src/lib/discovery/discoveryRecallMeasure";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

async function main(): Promise<void> {
  const groundTruthPath = resolve(
    projectRoot,
    ".validation/discovery-recall-ground-truth.json",
  );
  const groundTruth = JSON.parse(
    readFileSync(groundTruthPath, "utf8"),
  ) as DiscoveryRecallGroundTruth;

  const measure = await measureDiscoveryRecall(groundTruth);
  const speedReport = {
    measuredAt: measure.measuredAt,
    groundTruthGeneratedAt: measure.groundTruthGeneratedAt,
    recallPercent: measure.recallPercent,
    discoveredCount: measure.discoveredCount,
    latency: measure.latency,
    within6hRate:
      measure.latency.discoveredWithLatency > 0
        ? measure.latency.within6h / measure.latency.discoveredWithLatency
        : 0,
    within12hRate:
      measure.latency.discoveredWithLatency > 0
        ? measure.latency.within12h / measure.latency.discoveredWithLatency
        : 0,
    within24hRate:
      measure.latency.discoveredWithLatency > 0
        ? measure.latency.within24h / measure.latency.discoveredWithLatency
        : 0,
    targets: {
      medianHours12: measure.latency.medianHours != null && measure.latency.medianHours <= 12,
      within24h70pct:
        measure.latency.discoveredWithLatency > 0 &&
        measure.latency.within24h / measure.latency.discoveredWithLatency >= 0.7,
      p90Hours48: measure.latency.p90Hours != null && measure.latency.p90Hours <= 48,
    },
  };

  writeFileSync(
    resolve(projectRoot, ".validation/phase1-speed-remasure.json"),
    JSON.stringify(speedReport, null, 2),
  );

  console.log(JSON.stringify(speedReport, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
