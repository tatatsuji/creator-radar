#!/usr/bin/env node

import path from "node:path";

import {
  formatSeedLoadSummary,
  loadSeedChannelsFromFile,
} from "../src/lib/watchlist/seedLoader";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((arg) => arg !== "--dry-run");
  const csvPath = path.resolve(
    positional[0] ?? path.join(process.cwd(), "data/seeds/sample-channels.csv"),
  );

  const summary = await loadSeedChannelsFromFile({ csvPath, dryRun });
  console.log(formatSeedLoadSummary(summary));

  if (!summary.validation.valid || summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed load failed");
  process.exitCode = 1;
});
