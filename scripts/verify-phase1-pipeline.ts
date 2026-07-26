#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { buildWatchlistUploadSourceKey } from "../src/lib/discovery/sourceKey";

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

const env = loadEnvFile(resolve(projectRoot, ".env.local"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = env.CRON_SECRET;

if (!supabaseUrl || !serviceRoleKey || !cronSecret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or CRON_SECRET in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function assertMigrationApplied(): Promise<void> {
  const { error: watchlistError } = await supabase
    .from("channel_watchlist")
    .select("channel_id")
    .limit(1);
  const { error: observedError } = await supabase
    .from("videos")
    .select("last_observed_at")
    .limit(1);

  if (watchlistError || observedError) {
    throw new Error(
      [
        "Migration 003 is not applied yet.",
        watchlistError?.message ?? "channel_watchlist ok",
        observedError?.message ?? "last_observed_at ok",
        "Run SQL Editor steps first:",
        "1. supabase/migrations/003_phase1_pre_apply_checks.sql",
        "2. supabase/migrations/003_phase1_observability_foundation.sql",
      ].join("\n"),
    );
  }
}

async function getCounts() {
  const tables = [
    "channel_watchlist",
    "candidate_discoveries",
    "discovery_runs",
    "videos",
  ] as const;

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      throw new Error(`${table} count failed: ${error.message}`);
    }
    counts[table] = count ?? 0;
  }
  return counts;
}

async function getSampleDiscoveries(limit = 5) {
  const { data, error } = await supabase
    .from("candidate_discoveries")
    .select("video_id, channel_id, source_type, source_key, discovered_at")
    .order("discovered_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`candidate_discoveries sample failed: ${error.message}`);
  }

  return data ?? [];
}

async function runSeedLoad(): Promise<void> {
  await runCommand("npm", ["run", "seed:load"], projectRoot);
}

async function runDiscovery(baseUrl: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}/api/cron/discovery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Discovery failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function waitForServer(baseUrl: string, attempts = 30): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(baseUrl, { method: "GET" });
      if (response.ok || response.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  throw new Error(`Dev server did not become ready at ${baseUrl}`);
}

async function main(): Promise<void> {
  console.log("=== Phase 1 pipeline verification ===");
  await assertMigrationApplied();
  console.log("Migration check: OK");

  console.log("\n--- Seed load ---");
  await runSeedLoad();

  console.log("\n--- Start dev server ---");
  const baseUrl = "http://localhost:3000";
  let devServer: ReturnType<typeof spawn> | null = null;
  let startedDevServer = false;

  try {
    await fetch(baseUrl).catch(() => undefined);
    const ready = await fetch(baseUrl)
      .then((response) => response.ok || response.status === 404)
      .catch(() => false);

    if (!ready) {
      devServer = spawn("npm", ["run", "dev"], {
        cwd: projectRoot,
        stdio: "ignore",
        env: process.env,
      });
      startedDevServer = true;
      await waitForServer(baseUrl);
    }
    console.log("Dev server ready");

    console.log("\n--- Discovery run #1 ---");
    const discovery1 = await runDiscovery(baseUrl);
    console.log(JSON.stringify(discovery1, null, 2));

    const countsAfterFirst = await getCounts();
    console.log("\n--- Counts after discovery #1 ---");
    console.log(JSON.stringify(countsAfterFirst, null, 2));

    const samples = await getSampleDiscoveries();
    console.log("\n--- Sample discoveries ---");
    for (const row of samples) {
      console.log(JSON.stringify(row));
      if (row.channel_id) {
        const expected = buildWatchlistUploadSourceKey(row.channel_id);
        console.log(`  source_key expected prefix/channel match: ${row.source_key === expected ? "OK" : `NG (expected ${expected})`}`);
      }
    }

    console.log("\n--- Discovery run #2 ---");
    const discovery2 = await runDiscovery(baseUrl);
    console.log(JSON.stringify(discovery2, null, 2));

    const countsAfterSecond = await getCounts();
    console.log("\n--- Counts after discovery #2 ---");
    console.log(JSON.stringify(countsAfterSecond, null, 2));

    const { data: locks } = await supabase
      .from("channel_watchlist")
      .select("channel_id, lock_token, locked_until");
    const activeLocks = (locks ?? []).filter(
      (row) => row.lock_token || (row.locked_until && new Date(row.locked_until) > new Date()),
    );
    console.log("\n--- Active watchlist locks ---");
    console.log(activeLocks.length === 0 ? "none" : JSON.stringify(activeLocks, null, 2));
  } finally {
    if (startedDevServer && devServer?.pid) {
      devServer.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
