#!/usr/bin/env node

import { collectVideoSnapshots } from "../src/lib/snapshots/collect";

async function main(): Promise<void> {
  const result = await collectVideoSnapshots();
  console.log(JSON.stringify(result, null, 2));
  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
