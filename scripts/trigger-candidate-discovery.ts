#!/usr/bin/env node

import { runCandidateDiscoveryCron } from "../src/lib/discovery/runCandidateDiscoveryCron";

async function main(): Promise<void> {
  const result = await runCandidateDiscoveryCron();
  console.log(JSON.stringify(result, null, 2));
  if (result.candidateDiscovery.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
