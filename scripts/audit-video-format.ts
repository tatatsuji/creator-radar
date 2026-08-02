#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

import { aggregateCounts } from "../src/lib/discovery/videoFormatBackfill";
import { getPublishedAfter } from "../src/lib/ranking/periods";
import type { VideoRow } from "../src/types/database";

const PERIODS = ["24h", "3d", "7d", "30d"] as const;

function countLegacyShortsMisclassified(rows: VideoRow[]): number {
  return rows.filter(
    (row) =>
      row.is_short === false &&
      row.duration_seconds != null &&
      row.duration_seconds <= 180,
  ).length;
}

function countLegacyLiveMisclassified(rows: VideoRow[]): number {
  return rows.filter(
    (row) =>
      row.is_live === false &&
      (row.live_state === "active" ||
        row.live_state === "upcoming" ||
        row.live_broadcast_content === "live" ||
        row.live_broadcast_content === "upcoming"),
  ).length;
}

function countRankingPool(
  rows: VideoRow[],
  pool: "regular" | "short" | "live",
): number {
  return rows.filter((row) => {
    if (row.video_format == null || row.live_state == null) return false;
    if (pool === "live") return row.live_state === "active";
    if (row.live_state !== "none") return false;
    if (pool === "short") return row.video_format === "short";
    return row.video_format === "regular";
  }).length;
}

function countNewShortsInRegular(rows: VideoRow[]): number {
  return rows.filter(
    (row) =>
      row.video_format === "short" &&
      row.live_state === "none",
  ).length;
}

function countNewLiveInRegular(rows: VideoRow[]): number {
  return rows.filter((row) => row.live_state === "active").length;
}

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const report: Record<string, unknown> = {};

  const { data: allActive, error } = await supabase
    .from("videos")
    .select("*")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (allActive ?? []) as VideoRow[];
  report.totalActive = rows.length;
  report.overallCounts = aggregateCounts(rows);
  report.legacyShortsMisclassified = countLegacyShortsMisclassified(rows);
  report.legacyLiveMisclassified = countLegacyLiveMisclassified(rows);
  report.newClassification = {
    regularPool: countRankingPool(rows, "regular"),
    shortPool: countRankingPool(rows, "short"),
    livePool: countRankingPool(rows, "live"),
  };

  report.byPeriod = {};
  for (const period of PERIODS) {
    const publishedAfter = getPublishedAfter(period);
    const periodRows = rows.filter(
      (row) => row.published_at != null && row.published_at >= publishedAfter,
    );
    (report.byPeriod as Record<string, unknown>)[period] = {
      total: periodRows.length,
      counts: aggregateCounts(periodRows),
      rankingPools: {
        regular: countRankingPool(periodRows, "regular"),
        short: countRankingPool(periodRows, "short"),
        live: countRankingPool(periodRows, "live"),
      },
      legacyShortsMisclassified: countLegacyShortsMisclassified(periodRows),
      newShortsExcludedFromRegular: countNewShortsInRegular(periodRows),
      newLiveExcludedFromRegular: countNewLiveInRegular(periodRows),
      nullFormat: periodRows.filter(
        (row) => row.video_format == null || row.live_state == null,
      ).length,
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
