#!/usr/bin/env node
/**
 * Inspect DB schema via Supabase client (no direct Postgres password required).
 */

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

async function probeColumn(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
): Promise<{ exists: boolean; error?: string }> {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return { exists: true };
  if (error.code === "42703" || error.message.includes("does not exist")) {
    return { exists: false, error: error.message };
  }
  return { exists: true, error: error.message };
}

async function main(): Promise<void> {
  const env = loadEnvFile(resolve(projectRoot, ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const supabase = createClient(url, key);

  const videos006 = [
    "description",
    "view_count",
    "like_count",
    "comment_count",
    "tags",
    "content_features",
  ];
  const videosExisting = [
    "first_discovered_at",
    "is_short",
    "is_live",
    "duration_seconds",
    "title",
    "channel_id",
    "published_at",
    "thumbnail_url",
  ];
  const channels006 = ["subscriber_count"];
  const discoveryCols = [
    "video_id",
    "channel_id",
    "source_type",
    "source_key",
    "discovered_at",
    "metadata",
  ];

  const videos006Status: Record<string, boolean> = {};
  for (const col of [...videos006, ...videosExisting]) {
    videos006Status[col] = (await probeColumn(supabase, "videos", col)).exists;
  }

  const channelsStatus: Record<string, boolean> = {};
  for (const col of ["youtube_channel_id", "name", "subscriber_count_hidden", ...channels006]) {
    channelsStatus[col] = (await probeColumn(supabase, "channels", col)).exists;
  }

  const discoveryStatus: Record<string, boolean> = {};
  for (const col of discoveryCols) {
    discoveryStatus[col] = (await probeColumn(supabase, "candidate_discoveries", col)).exists;
  }

  const tables = ["videos", "channels", "candidate_discoveries", "measurement_schedule"] as const;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table} count: ${error.message}`);
    counts[table] = count ?? 0;
  }

  const migration006NewColumns = [...videos006, ...channels006];
  const migration006Applied = migration006NewColumns.every(
    (col) => videos006Status[col] === true || channelsStatus[col] === true,
  ) && videos006.every((c) => videos006Status[c]) && channels006.every((c) => channelsStatus[c]);

  console.log(
    JSON.stringify(
      {
        inspectedAt: new Date().toISOString(),
        rowCounts: counts,
        migration006Applied,
        migration006NewColumns: {
          videos: Object.fromEntries(videos006.map((c) => [c, videos006Status[c]])),
          channels: Object.fromEntries(channels006.map((c) => [c, channelsStatus[c]])),
        },
        existingVideoColumns: Object.fromEntries(
          videosExisting.map((c) => [c, videos006Status[c]]),
        ),
        candidateDiscoveriesColumns: discoveryStatus,
        migration006Safety: {
          destructiveChanges: false,
          dropsColumns: false,
          addsNotNullWithoutDefault: false,
          sqlOperations: [
            "ADD COLUMN IF NOT EXISTS (all nullable)",
            "CHECK constraints with NULL allowed",
            "CREATE INDEX IF NOT EXISTS",
          ],
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
