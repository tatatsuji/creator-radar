#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const hasFormatColumns = !(await supabase
    .from("videos")
    .select("video_format")
    .limit(1))
    .error;

  const select = hasFormatColumns
    ? "youtube_video_id,is_short,is_live,duration_seconds,video_format,live_state,live_broadcast_content,live_metadata_fetch_status,format_signals,updated_at"
    : "youtube_video_id,is_short,is_live,duration_seconds,updated_at";

  const { data, error } = await supabase
    .from("videos")
    .select(select)
    .eq("is_active", true);

  if (error) {
    throw new Error(`rollback snapshot failed: ${error.message}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(projectRoot, "data/rollback");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `video-format-pre-backfill-${timestamp}.json`);
  writeFileSync(path, JSON.stringify({ savedAt: new Date().toISOString(), rows: data }, null, 2));

  console.log(
    JSON.stringify(
      {
        status: "saved",
        path,
        rowCount: data?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
