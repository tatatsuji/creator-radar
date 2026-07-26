#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

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
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
const cronSecret = env.CRON_SECRET;

async function countTables() {
  const tables = [
    "measurement_schedule",
    "candidate_discoveries",
    "video_snapshots",
    "videos",
  ] as const;

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    counts[table] = count ?? 0;
  }

  const { data: observedSample, error: observedError } = await supabase
    .from("videos")
    .select("youtube_video_id, last_observed_at")
    .not("last_observed_at", "is", null)
    .order("last_observed_at", { ascending: false })
    .limit(3);

  if (observedError) {
    throw new Error(observedError.message);
  }

  const { data: snapshotSample, error: snapshotError } = await supabase
    .from("video_snapshots")
    .select("video_id, view_count, like_count, comment_count, captured_at")
    .order("captured_at", { ascending: false })
    .limit(3);

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  const { data: locks, error: lockError } = await supabase
    .from("measurement_schedule")
    .select("video_id, lock_token, locked_until")
    .not("lock_token", "is", null);

  if (lockError) {
    throw new Error(lockError.message);
  }

  const { data: dueSchedules, error: dueError } = await supabase
    .from("measurement_schedule")
    .select("video_id, measurement_status, next_measurement_at")
    .in("measurement_status", ["pending", "active"]);

  if (dueError) {
    throw new Error(dueError.message);
  }

  const nowMs = Date.now();
  const dueNow = (dueSchedules ?? []).filter(
    (row) =>
      !row.next_measurement_at ||
      new Date(row.next_measurement_at).getTime() <= nowMs,
  ).length;

  return {
    counts,
    dueNow,
    observedSample,
    snapshotSample,
    activeLocks: locks ?? [],
  };
}

async function runMeasurement(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/cron/measurement`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Measurement failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForServer(baseUrl: string): Promise<void> {
  for (let index = 0; index < 30; index += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok || response.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  throw new Error(`Dev server not ready at ${baseUrl}`);
}

async function main(): Promise<void> {
  console.log("=== Phase 2 measurement verification ===");

  const { backfillMeasurementSchedules, formatMeasurementBackfillSummary } =
    await import("../src/lib/measurement/backfill");

  const dryRun = await backfillMeasurementSchedules({ dryRun: true });
  console.log("\n--- Backfill dry-run ---");
  console.log(formatMeasurementBackfillSummary(dryRun));

  const backfill = await backfillMeasurementSchedules({ dryRun: false });
  console.log("\n--- Backfill apply ---");
  console.log(formatMeasurementBackfillSummary(backfill));

  console.log("\n--- Before measurement ---");
  console.log(JSON.stringify(await countTables(), null, 2));

  const baseUrl = "http://localhost:3000";
  let devServer: ReturnType<typeof import("node:child_process").spawn> | null =
    null;
  let startedDevServer = false;

  try {
    const ready = await fetch(baseUrl)
      .then((response) => response.ok || response.status === 404)
      .catch(() => false);

    if (!ready) {
      const { spawn } = await import("node:child_process");
      devServer = spawn("npm", ["run", "dev"], {
        cwd: projectRoot,
        stdio: "ignore",
        env: process.env,
      });
      startedDevServer = true;
      await waitForServer(baseUrl);
    }

    console.log("\n--- Measurement run #1 ---");
    console.log(JSON.stringify(await runMeasurement(baseUrl), null, 2));
    console.log("\n--- After measurement #1 ---");
    console.log(JSON.stringify(await countTables(), null, 2));

    console.log("\n--- Measurement run #2 ---");
    console.log(JSON.stringify(await runMeasurement(baseUrl), null, 2));
    console.log("\n--- After measurement #2 ---");
    console.log(JSON.stringify(await countTables(), null, 2));
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
