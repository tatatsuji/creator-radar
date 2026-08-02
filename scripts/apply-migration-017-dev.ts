#!/usr/bin/env node
/**
 * Verify migration 017 via Supabase client.
 * Apply the SQL manually in Supabase SQL Editor (no SUPABASE_DB_PASSWORD required).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  formatMigration017SqlEditorInstructions,
  verifyMigration017,
} from "../src/lib/db/migration017";

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

async function probeColumn(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
}

async function main(): Promise<void> {
  const envPath = resolve(projectRoot, ".env.local");
  const fileEnv = existsSync(envPath) ? loadEnvFile(envPath) : {};
  const env = { ...fileEnv, ...process.env } as Record<string, string>;

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const status = await verifyMigration017((table, column) =>
    probeColumn(supabase, table, column),
  );

  if (status.applied) {
    console.log(JSON.stringify({ status: "applied", missing: [] }, null, 2));
    return;
  }

  console.error(formatMigration017SqlEditorInstructions(projectRoot));
  console.error(
    JSON.stringify({ status: "not_applied", missing: status.missing }, null, 2),
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
