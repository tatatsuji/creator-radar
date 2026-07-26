#!/usr/bin/env node

import { runMeasurement } from "../src/lib/measurement/runMeasurement";

async function main(): Promise<void> {
  const result = await runMeasurement();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
