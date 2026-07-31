#!/usr/bin/env node

import { loadWebsubObservabilityStatus } from "../src/lib/observability/websubStatus";

async function main(): Promise<void> {
  const status = await loadWebsubObservabilityStatus();
  console.log(JSON.stringify(status, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
