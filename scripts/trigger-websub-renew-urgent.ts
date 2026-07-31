#!/usr/bin/env node

import { runWebsubRenewUrgentCron } from "../src/lib/websub/runWebsubSubscribeManagerCron";

async function main(): Promise<void> {
  const result = await runWebsubRenewUrgentCron();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
