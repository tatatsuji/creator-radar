#!/usr/bin/env node
/**
 * Step1-A production pipeline (after SQL Editor migration):
 * verify → rollback save → dry-run → backfill → DB audit
 */

import { execSync } from "node:child_process";

function run(command: string): void {
  console.log(`\n$ ${command}\n`);
  execSync(command, { stdio: "inherit", cwd: process.cwd() });
}

async function main(): Promise<void> {
  run("npm run db:verify:017");
  run("npm run video-format:rollback-save");
  run("npm run video-format:backfill:dry-run");
  run("npm run video-format:backfill");
  run("npm run audit:video-format");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
