#!/usr/bin/env node
/**
 * Phase1 speed verification: post-6h-cron discoveries only.
 * Does NOT mix historical pre-cron discovery latency.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { PHASE1_VERIFICATION } from "../src/lib/observability/phase1Verification";
import type { DiscoverySourceType } from "../src/types/observability";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = resolve(projectRoot, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
  }
  return { ...env, ...process.env } as Record<string, string>;
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? null;
}

function hoursBetween(startIso: string, endIso: string): number {
  return Math.max(0, (Date.parse(endIso) - Date.parse(startIso)) / 3_600_000);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const cronStart =
    process.env.PHASE1_6H_CRON_START_ISO ?? PHASE1_VERIFICATION.sixHourCronStartIso;
  const now = new Date();

  const { data: videos, error: videoErr } = await supabase
    .from("videos")
    .select("youtube_video_id,published_at,first_discovered_at,category_id")
    .gte("first_discovered_at", cronStart)
    .not("published_at", "is", null)
    .not("first_discovered_at", "is", null);

  if (videoErr) {
    throw new Error(videoErr.message);
  }

  const { data: discoveries } = await supabase
    .from("candidate_discoveries")
    .select("video_id,source_type,discovered_at")
    .gte("discovered_at", cronStart)
    .order("discovered_at", { ascending: true });

  const firstSourceByVideo = new Map<string, DiscoverySourceType>();
  for (const row of discoveries ?? []) {
    if (!firstSourceByVideo.has(row.video_id as string)) {
      firstSourceByVideo.set(row.video_id as string, row.source_type as DiscoverySourceType);
    }
  }

  const latencyRows: Array<{
    videoId: string;
    hours: number;
    categoryId: string | null;
    firstSource: DiscoverySourceType | null;
  }> = [];

  for (const video of videos ?? []) {
    const hours = hoursBetween(
      video.published_at as string,
      video.first_discovered_at as string,
    );
    latencyRows.push({
      videoId: video.youtube_video_id as string,
      hours,
      categoryId: (video.category_id as string | null) ?? null,
      firstSource: firstSourceByVideo.get(video.youtube_video_id as string) ?? null,
    });
  }

  const hours = latencyRows.map((r) => r.hours);
  const bySource: Record<string, { count: number; medianHours: number | null }> = {};
  const byCategory: Record<string, { count: number; medianHours: number | null }> = {};

  for (const source of [...new Set(latencyRows.map((r) => r.firstSource ?? "unknown"))]) {
    const subset = latencyRows.filter((r) => (r.firstSource ?? "unknown") === source).map((r) => r.hours);
    bySource[source] = { count: subset.length, medianHours: percentile(subset, 0.5) };
  }
  for (const cat of [...new Set(latencyRows.map((r) => r.categoryId ?? "unknown"))]) {
    const subset = latencyRows.filter((r) => (r.categoryId ?? "unknown") === cat).map((r) => r.hours);
    byCategory[cat] = { count: subset.length, medianHours: percentile(subset, 0.5) };
  }

  const { data: discoveryRuns } = await supabase
    .from("discovery_runs")
    .select("status,started_at,finished_at,error_summary,youtube_quota_estimate,run_type")
    .gte("started_at", cronStart)
    .order("started_at", { ascending: true });

  const rankingRuns = (discoveryRuns ?? []).filter((r) => r.run_type === "ranking_generation");
  const successRuns = rankingRuns.filter((r) => r.status === "success" || r.status === "partial");
  const lockSkips = rankingRuns.filter((r) =>
    (r.error_summary ?? "").includes("already in progress"),
  ).length;

  const intervals: number[] = [];
  for (let i = 1; i < rankingRuns.length; i += 1) {
    const prev = Date.parse(rankingRuns[i - 1]!.started_at as string);
    const curr = Date.parse(rankingRuns[i]!.started_at as string);
    intervals.push((curr - prev) / 3_600_000);
  }

  const quotaUsed = (discoveryRuns ?? []).reduce(
    (sum, r) => sum + (Number(r.youtube_quota_estimate) || 0),
    0,
  );

  const sampleCount = latencyRows.length;
  const sufficientSample = sampleCount >= PHASE1_VERIFICATION.minSpeedSampleSize;
  const hoursSinceCronStart = hoursBetween(cronStart, now.toISOString());
  const extendTo72h = !sufficientSample && hoursSinceCronStart < PHASE1_VERIFICATION.extendedVerificationHours;

  const report = {
    measuredAt: now.toISOString(),
    cronStartIso: cronStart,
    hoursSinceCronStart,
    scope: "post_6h_cron_discoveries_only",
    sampleCount,
    sufficientSample,
    extendTo72h,
    verdict: sufficientSample ? "24h_speed_measurable" : extendTo72h ? "extend_to_72h" : "insufficient_data",
    latency: {
      medianHours: percentile(hours, 0.5),
      p90Hours: percentile(hours, 0.9),
      within6h: hours.filter((h) => h <= 6).length,
      within12h: hours.filter((h) => h <= 12).length,
      within24h: hours.filter((h) => h <= 24).length,
      within6hRate: sampleCount > 0 ? hours.filter((h) => h <= 6).length / sampleCount : 0,
      within12hRate: sampleCount > 0 ? hours.filter((h) => h <= 12).length / sampleCount : 0,
      within24hRate: sampleCount > 0 ? hours.filter((h) => h <= 24).length / sampleCount : 0,
    },
    bySource,
    byCategory,
    cron: {
      totalRuns: rankingRuns.length,
      successRuns: successRuns.length,
      successRate: rankingRuns.length > 0 ? successRuns.length / rankingRuns.length : null,
      lockSkips,
      medianIntervalHours: percentile(intervals, 0.5),
      intervalsHours: intervals,
    },
    quotaUsedSinceCronStart: quotaUsed,
    passCriteria: {
      medianHours12:
        percentile(hours, 0.5) != null &&
        percentile(hours, 0.5)! <= PHASE1_VERIFICATION.speedTargets.medianHours,
      p90Hours48:
        percentile(hours, 0.9) != null &&
        percentile(hours, 0.9)! <= PHASE1_VERIFICATION.speedTargets.p90Hours,
      within24h70:
        sampleCount > 0 &&
        hours.filter((h) => h <= 24).length / sampleCount >=
          PHASE1_VERIFICATION.speedTargets.within24hRate,
      cronSuccess95:
        rankingRuns.length > 0 &&
        successRuns.length / rankingRuns.length >= PHASE1_VERIFICATION.speedTargets.cronSuccessRate,
    },
  };

  mkdirSync(resolve(projectRoot, ".validation"), { recursive: true });
  writeFileSync(
    resolve(projectRoot, ".validation/phase1-speed-remasure.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
