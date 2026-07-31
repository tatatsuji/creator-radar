#!/usr/bin/env node

import { runWatchlistDiscoveryCron } from "../src/lib/discovery/runWatchlistDiscoveryCron";

async function main(): Promise<void> {
  const result = await runWatchlistDiscoveryCron();
  console.log(JSON.stringify(result, null, 2));
  if (result.watchlist.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
