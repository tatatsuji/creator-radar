#!/usr/bin/env node

import {
  backfillMeasurementSchedules,
  formatMeasurementBackfillSummary,
} from "../src/lib/measurement/backfill";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const summary = await backfillMeasurementSchedules({ dryRun });
  console.log(formatMeasurementBackfillSummary(summary));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backfill failed");
  process.exitCode = 1;
});
