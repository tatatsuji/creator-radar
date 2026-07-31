#!/usr/bin/env node

import { runAutoWatchlistCron } from "../src/lib/watchlist/autoWatchlist/runAutoWatchlistCron";

async function main(): Promise<void> {
  const result = await runAutoWatchlistCron();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
