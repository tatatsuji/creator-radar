#!/usr/bin/env node

import { buildDailyReport, buildDailyVelocitySamples } from "../src/lib/observability/dailyReport";

async function main(): Promise<void> {
  const [report, velocitySamples] = await Promise.all([
    buildDailyReport(),
    buildDailyVelocitySamples(10),
  ]);

  console.log("=== Daily Observability Report ===");
  console.log(JSON.stringify(report, null, 2));

  console.log("\n=== Velocity Samples (max 10 videos) ===");
  console.log(JSON.stringify(velocitySamples, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
