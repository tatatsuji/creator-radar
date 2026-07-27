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

function extractProjectRef(supabaseUrl: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error("Could not parse Supabase project ref from NEXT_PUBLIC_SUPABASE_URL");
  }
  return match[1];
}

async function columnExists(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
}

async function verifyMigration006(
  supabase: ReturnType<typeof createClient>,
): Promise<{ applied: boolean; missing: string[] }> {
  const checks = [
    ["videos", "description"],
    ["videos", "view_count"],
    ["videos", "like_count"],
    ["videos", "comment_count"],
    ["videos", "tags"],
    ["videos", "content_features"],
    ["channels", "subscriber_count"],
  ] as const;

  const missing: string[] = [];
  for (const [table, column] of checks) {
    if (!(await columnExists(supabase, table, column))) {
      missing.push(`${table}.${column}`);
    }
  }

  return { applied: missing.length === 0, missing };
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
    "supabase/migrations/006_phase1_candidate_enrichment.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const fileEnv = loadEnvFile(resolve(projectRoot, ".env.local"));
  const env = { ...fileEnv, ...process.env } as Record<string, string>;
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const before = await verifyMigration006(supabase);
  if (before.applied) {
    console.log(JSON.stringify({ status: "already_applied", missing: [] }, null, 2));
    return;
  }

  if (!env.SUPABASE_DB_PASSWORD) {
    console.error(JSON.stringify({
      status: "blocked",
      missingBefore: before.missing,
      message:
        "Add SUPABASE_DB_PASSWORD to .env.local (Supabase Dashboard → Settings → Database), then rerun: npm run db:apply:006-dev",
      fallback:
        "Or paste supabase/migrations/006_phase1_candidate_enrichment.sql into Supabase SQL Editor.",
    }, null, 2));
    process.exit(1);
  }

  console.log("Applying 006_phase1_candidate_enrichment.sql...");
  await applyMigrationWithPostgres(env);

  const after = await verifyMigration006(supabase);
  if (!after.applied) {
    throw new Error(
      `Migration applied but columns still missing: ${after.missing.join(", ")}`,
    );
  }

  console.log(JSON.stringify({ status: "applied", missingBefore: before.missing }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
