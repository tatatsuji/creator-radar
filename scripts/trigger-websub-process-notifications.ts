#!/usr/bin/env node

import { runWebsubNotificationWorkerCron } from "../src/lib/websub/runWebsubNotificationWorkerCron";

async function main(): Promise<void> {
  const result = await runWebsubNotificationWorkerCron();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
