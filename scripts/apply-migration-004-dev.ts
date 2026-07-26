#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function extractProjectRef(supabaseUrl: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error("Could not parse Supabase project ref from NEXT_PUBLIC_SUPABASE_URL");
  }
  return match[1];
}

async function columnExists(
  supabase: { from: (table: string) => { select: (columns: string) => { limit: (count: number) => PromiseLike<{ error: { code?: string } | null }> } } },
): Promise<boolean> {
  const probe = await supabase.from("snapshot_runs").select("run_type").limit(1);
  return !probe.error || probe.error.code !== "42703";
}

async function applyMigrationWithPostgres(
  env: Record<string, string>,
): Promise<void> {
  const password = env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error("SUPABASE_DB_PASSWORD is not set in .env.local");
  }

  const projectRef = extractProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const connectionString =
    env.SUPABASE_DB_URL ??
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;

  const sqlPath = resolve(
    projectRoot,
    "supabase/migrations/004_snapshot_runs_run_type.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");

  const { Client } = await import("pg");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const env = loadEnvFile(resolve(projectRoot, ".env.local"));
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (await columnExists(supabase)) {
    console.log("run_type column already exists on dev DB.");
    return;
  }

  if (!env.SUPABASE_DB_PASSWORD) {
    console.error("run_type column is missing on dev DB.");
    console.error("Add SUPABASE_DB_PASSWORD to .env.local (Supabase Dashboard → Settings → Database), then rerun:");
    console.error("  npm run db:apply:004-dev");
    console.error("");
    console.error("Or paste supabase/migrations/004_snapshot_runs_run_type.sql into Supabase SQL Editor.");
    process.exit(1);
  }

  console.log("Applying 004_snapshot_runs_run_type.sql to dev DB...");
  await applyMigrationWithPostgres(env);

  if (!(await columnExists(supabase))) {
    throw new Error("Migration applied but run_type column is still missing");
  }

  console.log("Migration applied successfully on dev DB.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
