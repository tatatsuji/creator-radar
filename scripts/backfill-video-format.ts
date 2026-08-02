#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  backfillVideoFormatClassification,
  formatVideoFormatBackfillSummary,
} from "../src/lib/discovery/videoFormatBackfill";
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

async function assertMigration017Applied(): Promise<void> {
  const envPath = resolve(projectRoot, ".env.local");
  const fileEnv = existsSync(envPath) ? loadEnvFile(envPath) : {};
  const env = { ...fileEnv, ...process.env } as Record<string, string>;
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const status = await verifyMigration017(async (table, column) => {
    const { error } = await supabase.from(table).select(column).limit(1);
    return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
  });

  if (!status.applied) {
    console.error(formatMigration017SqlEditorInstructions(projectRoot));
    throw new Error(
      `Migration 017 not applied. Missing: ${status.missing.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const noOEmbed = args.includes("--no-oembed");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;

  await assertMigration017Applied();

  const summary = await backfillVideoFormatClassification({
    dryRun,
    useOEmbed: !noOEmbed,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  console.log(formatVideoFormatBackfillSummary(summary));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
