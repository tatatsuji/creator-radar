#!/usr/bin/env node

import { runWatchlistDiscovery } from "../src/lib/discovery/runWatchlistDiscovery";

async function main(): Promise<void> {
  const result = await runWatchlistDiscovery();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
