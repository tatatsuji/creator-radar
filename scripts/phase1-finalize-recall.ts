#!/usr/bin/env node
/**
 * Phase1 finalize: apply migration 006 (if creds available), run discovery,
 * rebuild ground truth, measure recall, optionally fix 22 misses if recall >= 80%.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { buildDiscoveryRecallGroundTruth } from "../src/lib/discovery/discoveryRecallGroundTruth";
import { measureDiscoveryRecall } from "../src/lib/discovery/discoveryRecallMeasure";
import {
  applyMigration006WithPostgres,
  buildSupabasePostgresConnectionString,
  verifyMigration006,
} from "../src/lib/db/migration006";
import { runDiscoveryCron } from "../src/lib/discovery/runDiscoveryCron";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const RECALL_TARGET = 0.8;

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(projectRoot, ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function probeColumn(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
}

async function tryApplyMigration006(env: Record<string, string>): Promise<{
  status: string;
  missing?: string[];
}> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const before = await verifyMigration006((table, column) =>
    probeColumn(supabase, table, column),
  );

  if (before.applied) {
    return { status: "already_applied" };
  }

  const connectionString = buildSupabasePostgresConnectionString({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_DB_PASSWORD: env.SUPABASE_DB_PASSWORD,
    SUPABASE_DB_URL: env.SUPABASE_DB_URL,
  });

  if (!connectionString) {
    return { status: "blocked", missing: before.missing };
  }

  await applyMigration006WithPostgres({ connectionString, projectRoot });
  const after = await verifyMigration006((table, column) =>
    probeColumn(supabase, table, column),
  );

  if (!after.applied) {
    throw new Error(`Migration failed: ${after.missing.join(", ")}`);
  }

  return { status: "applied", missing: before.missing };
}

async function buildGroundTruthWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const groundTruth = await buildDiscoveryRecallGroundTruth();
      writeFileSync(
        resolve(projectRoot, ".validation/discovery-recall-ground-truth.json"),
        JSON.stringify(groundTruth, null, 2),
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Quota exceeded") || attempt === maxAttempts) {
        throw error;
      }
      const waitMs = attempt * 60_000;
      console.log(JSON.stringify({ quotaRetry: attempt, waitMs }));
      await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
    }
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const skipDiscovery = args.has("--skip-discovery");
  const skipMigration = args.has("--skip-migration");
  const env = loadEnv();

  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
  };

  if (!skipMigration) {
    report.migration006 = await tryApplyMigration006(env);
  }

  if (!skipDiscovery) {
    report.discovery = await runDiscoveryCron();
  }

  await buildGroundTruthWithRetry();
  const groundTruth = JSON.parse(
    readFileSync(resolve(projectRoot, ".validation/discovery-recall-ground-truth.json"), "utf8"),
  );
  const measure = await measureDiscoveryRecall(groundTruth);
  writeFileSync(
    resolve(projectRoot, ".validation/discovery-recall-report.json"),
    JSON.stringify(measure, null, 2),
  );

  report.recall = {
    recallPercent: measure.recallPercent,
    discoveredCount: measure.discoveredCount,
    missedCount: measure.missedCount,
    mainstreamBuzzRecall: measure.mainstreamBuzzRecall,
    latency: measure.latency,
  };
  report.needsMissedFix = measure.recall >= RECALL_TARGET;
  report.finishedAt = new Date().toISOString();

  writeFileSync(
    resolve(projectRoot, ".validation/phase1-recall-finalize.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
