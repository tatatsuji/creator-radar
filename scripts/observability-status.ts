#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDefaultQuotaScenarios } from "../src/lib/observability/quotaEstimates";
import { loadObservabilityStatus } from "../src/lib/observability/status";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function main(): Promise<void> {
  const status = await loadObservabilityStatus();

  console.log("=== Observability Status ===");
  console.log(JSON.stringify(status, null, 2));

  console.log("\n=== Quota Scenarios (units/day) ===");
  for (const scenario of buildDefaultQuotaScenarios()) {
    console.log(
      `${scenario.label}: discovery=${scenario.discoveryUnitsPerDay}, measurement=${scenario.measurementUnitsPerDay}, total=${scenario.totalUnitsPerDay}, withinQuota=${scenario.withinDailyQuota}`,
    );
  }

  const env = loadEnvFile(resolve(projectRoot, ".env.local"));
  if (!env.ADMIN_SECRET) {
    console.log(
      "\nADMIN_SECRET is not configured in .env.local. Admin API requires it.",
    );
    console.log(
      "Setup: add a line `ADMIN_SECRET=<your-secret>` to .env.local and restart dev server.",
    );
  } else {
    console.log("\nADMIN_SECRET is configured in .env.local.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
