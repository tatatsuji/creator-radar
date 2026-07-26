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

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const env = loadEnvFile(resolve(projectRoot, ".env.local"));
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("measurement_schedule")
    .select("video_id, lock_token, locked_until")
    .not("lock_token", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const expired = rows.filter(
    (row) => !row.locked_until || row.locked_until <= nowIso,
  );
  const active = rows.filter(
    (row) => row.locked_until && row.locked_until > nowIso,
  );

  console.log(
    JSON.stringify(
      {
        dryRun,
        totalLockedRows: rows.length,
        expiredLocks: expired.length,
        activeLocks: active.length,
      },
      null,
      2,
    ),
  );

  if (dryRun || (expired.length === 0 && !force)) {
    if (!dryRun && force && rows.length === 0) {
      console.log("No locks to release.");
    }
    return;
  }

  let query = supabase
    .from("measurement_schedule")
    .update({
      lock_token: null,
      locked_until: null,
      updated_at: nowIso,
    })
    .not("lock_token", "is", null);

  if (!force) {
    query = query.lte("locked_until", nowIso);
  }

  const { error: updateError } = await query;

  if (updateError) {
    throw new Error(updateError.message);
  }

  console.log(`Released ${force ? rows.length : expired.length} measurement lock(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
