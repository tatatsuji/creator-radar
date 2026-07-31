#!/usr/bin/env node

import { runMeasurementCron } from "../src/lib/measurement/runMeasurementCron";

async function main(): Promise<void> {
  const result = await runMeasurementCron();
  console.log(JSON.stringify(result, null, 2));
  if (result.quotaStatus === "deferred") {
    process.exit(0);
  }
  if (result.measurement?.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
