#!/usr/bin/env node
/**
 * Full production verification for Phase1 + buzz ranking.
 * Usage: tsx --env-file=.env.local scripts/prod-verification.ts [--apply-migration] [--skip-cron]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { auditBuzzTop100 } from "../src/lib/ranking/buzzRankingQuality";
import { buildRankings } from "../src/lib/ranking/buildRankings";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PROD_URL =
  process.env.AUDIT_BASE_URL ?? "https://creator-radar-laj6.vercel.app";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(projectRoot, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
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

async function checkMigration006(supabase: ReturnType<typeof createClient>) {
  const videoCols = [
    "description",
    "view_count",
    "like_count",
    "comment_count",
    "tags",
    "content_features",
  ];
  const channelCols = ["subscriber_count"];
  const videos: Record<string, boolean> = {};
  const channels: Record<string, boolean> = {};
  for (const col of videoCols) {
    videos[col] = await probeColumn(supabase, "videos", col);
  }
  for (const col of channelCols) {
    channels[col] = await probeColumn(supabase, "channels", col);
  }
  const applied =
    Object.values(videos).every(Boolean) && Object.values(channels).every(Boolean);
  return { applied, videos, channels };
}

async function applyMigration006(env: Record<string, string>): Promise<boolean> {
  const password = env.SUPABASE_DB_PASSWORD;
  if (!password) return false;
  const match = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error("Invalid Supabase URL");
  const projectRef = match[1];
  const connectionString =
    env.SUPABASE_DB_URL ??
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  const sql = readFileSync(
    resolve(projectRoot, "supabase/migrations/006_phase1_candidate_enrichment.sql"),
    "utf8",
  );
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    return true;
  } finally {
    await client.end();
  }
}

async function triggerCron(
  path: string,
  cronSecret: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${PROD_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text body
  }
  return { status: response.status, body };
}

async function fetchBuzzFromProd(): Promise<{ videos: Awaited<ReturnType<typeof buildRankings>>["videos"]; raw: unknown }> {
  const response = await fetch(`${PROD_URL}/api/rankings?ranking=buzz&period=24h&genre=all`);
  const raw = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(raw));
  return { videos: (raw as { videos: [] }).videos ?? [], raw };
}

async function auditDb(supabase: ReturnType<typeof createClient>, sinceIso: string) {
  const { data: discoveries, error: dErr } = await supabase
    .from("candidate_discoveries")
    .select("video_id,source_type,discovered_at")
    .gte("discovered_at", sinceIso);
  if (dErr) throw new Error(dErr.message);

  const sourceCounts: Record<string, number> = {};
  for (const row of discoveries ?? []) {
    const key = row.source_type as string;
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1;
  }

  const totalBeforeDedup = discoveries?.length ?? 0;
  const uniqueVideos = new Set((discoveries ?? []).map((r) => r.video_id)).size;
  const duplicateRate =
    totalBeforeDedup > 0 ? (totalBeforeDedup - uniqueVideos) / totalBeforeDedup : 0;

  const { data: videos, error: vErr } = await supabase
    .from("videos")
    .select(
      "youtube_video_id,title,channel_id,published_at,duration_seconds,thumbnail_url,category_id,is_short,is_live,first_discovered_at,last_seen_at",
    )
    .eq("is_active", true)
    .gte("first_discovered_at", sinceIso)
    .limit(500);
  if (vErr) throw new Error(vErr.message);

  const { count: scheduleCount } = await supabase
    .from("measurement_schedule")
    .select("*", { count: "exact", head: true });

  const { data: schedules } = await supabase
    .from("measurement_schedule")
    .select("video_id,measurement_status,next_measurement_at");

  const statusCounts: Record<string, number> = {};
  for (const row of schedules ?? []) {
    const st = row.measurement_status as string;
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
  }

  const discoveredVideoIds = [...new Set((discoveries ?? []).map((r) => r.video_id))];
  const { data: snapRows } = await supabase
    .from("video_snapshots")
    .select("video_id")
    .in("video_id", discoveredVideoIds.slice(0, 200));

  const snapCounts = new Map<string, number>();
  for (const row of snapRows ?? []) {
    snapCounts.set(row.video_id, (snapCounts.get(row.video_id) ?? 0) + 1);
  }
  let snap1 = 0;
  let snap2 = 0;
  let snap3 = 0;
  for (const count of snapCounts.values()) {
    if (count >= 1) snap1 += 1;
    if (count >= 2) snap2 += 1;
    if (count >= 3) snap3 += 1;
  }

  const categoryCounts: Record<string, number> = {};
  const classCounts = { regular: 0, short: 0, live: 0, unknown: 0 };
  const nullCounts = {
    title: 0,
    channel_id: 0,
    published_at: 0,
    duration_seconds: 0,
    thumbnail_url: 0,
    view_count: 0,
    content_features: 0,
    first_discovered_at: 0,
  };

  for (const row of videos ?? []) {
    const cat = (row.category_id as string | null) ?? "unknown";
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    if (row.is_live === true) classCounts.live += 1;
    else if (row.is_short === true) classCounts.short += 1;
    else if (row.is_live === false && row.is_short === false) classCounts.regular += 1;
    else classCounts.unknown += 1;
    if (!row.title) nullCounts.title += 1;
    if (!row.channel_id) nullCounts.channel_id += 1;
    if (!row.published_at) nullCounts.published_at += 1;
    if (row.duration_seconds == null) nullCounts.duration_seconds += 1;
    if (!row.thumbnail_url) nullCounts.thumbnail_url += 1;
    nullCounts.view_count += 1;
    nullCounts.content_features += 1;
    if (!row.first_discovered_at) nullCounts.first_discovered_at += 1;
  }

  let channelSubNull: number | null = null;
  const subProbe = await supabase.from("channels").select("subscriber_count").limit(1);
  if (!subProbe.error) {
    const { count } = await supabase
      .from("channels")
      .select("*", { count: "exact", head: true })
      .is("subscriber_count", null);
    channelSubNull = count ?? 0;
  }

  const scheduleVideoIds = new Set((schedules ?? []).map((r) => r.video_id));
  const unregistered = discoveredVideoIds.filter((id) => !scheduleVideoIds.has(id));

  // trace one video
  const traceVideoId = discoveredVideoIds[0] ?? null;
  let trace: Record<string, unknown> | null = null;
  if (traceVideoId) {
    const { data: vRow } = await supabase
      .from("videos")
      .select("*")
      .eq("youtube_video_id", traceVideoId)
      .maybeSingle();
    const { data: dRows } = await supabase
      .from("candidate_discoveries")
      .select("*")
      .eq("video_id", traceVideoId)
      .order("discovered_at", { ascending: false })
      .limit(5);
    const { data: sRow } = await supabase
      .from("measurement_schedule")
      .select("*")
      .eq("video_id", traceVideoId)
      .maybeSingle();
    const { data: snaps } = await supabase
      .from("video_snapshots")
      .select("*")
      .eq("video_id", traceVideoId)
      .order("captured_at", { ascending: true });
    trace = {
      videoId: traceVideoId,
      discoveries: dRows,
      video: vRow,
      schedule: sRow,
      snapshots: snaps,
    };
  }

  return {
    discoveries: {
      totalBeforeDedup,
      uniqueVideos,
      duplicateRate,
      sourceCounts,
      newVideosSince: videos?.length ?? 0,
    },
    measurement: {
      discoveredCount: discoveredVideoIds.length,
      scheduleTotal: scheduleCount ?? 0,
      unregisteredCount: unregistered.length,
      statusCounts,
      snapshotDistribution: { snap1, snap2, snap3 },
      connectionRate:
        discoveredVideoIds.length > 0
          ? (discoveredVideoIds.length - unregistered.length) / discoveredVideoIds.length
          : 1,
    },
    dataQuality: {
      nullCounts,
      subscriber_count_null_channels: channelSubNull ?? 0,
      categoryCounts,
      classCounts,
    },
    trace,
  };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const env = loadEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    prodUrl: PROD_URL,
  };

  // 1. Migration
  let migration = await checkMigration006(supabase);
  if (!migration.applied && args.has("--apply-migration")) {
    const applied = await applyMigration006(env);
    migration = await checkMigration006(supabase);
    report.migrationApplyAttempted = applied;
  }
  report.migration006 = migration;

  // 3. Discovery cron
  if (!args.has("--skip-cron") && env.CRON_SECRET) {
    report.discoveryCron1 = await triggerCron("/api/cron/discovery", env.CRON_SECRET);
    await new Promise((r) => setTimeout(r, 3000));
  }

  const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  report.dbAudit = await auditDb(supabase, sinceIso);

  // 4. Measurement cron
  if (!args.has("--skip-cron") && env.CRON_SECRET) {
    report.measurementCron = await triggerCron("/api/cron/measurement", env.CRON_SECRET);
  }

  // 5. Buzz audit
  const buzz = await fetchBuzzFromProd();
  const audit = auditBuzzTop100(buzz.videos);
  const channelCounts = new Map<string, number>();
  for (const v of buzz.videos) {
    channelCounts.set(v.channel.id, (channelCounts.get(v.channel.id) ?? 0) + 1);
  }
  const maxPerChannel = Math.max(0, ...channelCounts.values());
  report.buzzTop100 = {
    ...audit,
    measuredRatePct: Math.round(audit.measuredRate * 1000) / 10,
    maxPerChannel,
    apiTotal: buzz.videos.length,
  };

  // 8. Second discovery cron
  if (!args.has("--skip-cron") && env.CRON_SECRET && args.has("--idempotency")) {
    const beforeVideos = await supabase.from("videos").select("youtube_video_id,first_discovered_at,last_seen_at");
    report.discoveryCron2 = await triggerCron("/api/cron/discovery", env.CRON_SECRET);
    const afterVideos = await supabase.from("videos").select("youtube_video_id,first_discovered_at,last_seen_at");
    const beforeMap = new Map(
      (beforeVideos.data ?? []).map((r) => [r.youtube_video_id, r]),
    );
    let firstDiscoveredOverwritten = 0;
    let lastSeenUpdated = 0;
    for (const row of afterVideos.data ?? []) {
      const prev = beforeMap.get(row.youtube_video_id);
      if (!prev) continue;
      if (prev.first_discovered_at !== row.first_discovered_at) firstDiscoveredOverwritten += 1;
      if (prev.last_seen_at !== row.last_seen_at) lastSeenUpdated += 1;
    }
    report.idempotency = { firstDiscoveredOverwritten, lastSeenUpdated };
  }

  const outPath = resolve(projectRoot, ".validation/prod-verification-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
