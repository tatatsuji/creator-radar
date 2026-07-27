#!/usr/bin/env node

import { runDiscoveryCron } from "../src/lib/discovery/runDiscoveryCron";

async function main(): Promise<void> {
  const result = await runDiscoveryCron();
  console.log(JSON.stringify(result, null, 2));
  if (result.watchlist.status === "failed" && !result.ranking) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
