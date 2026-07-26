#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectVideoSnapshots } from "../src/lib/snapshots/collect";
import { runMeasurement } from "../src/lib/measurement/runMeasurement";
import {
  computeLatestSnapshotGrowth,
  computeSnapshotGrowthSeries,
} from "../src/lib/snapshots/snapshotGrowth";
import {
  countVideoSnapshots,
  countVideoSnapshotsSince,
  countVideoSnapshotsWithSubscriberCount,
  countVideosWithMultipleSnapshots,
  fetchSnapshotsForVideo,
  getLatestVideoSnapshotCapturedAt,
} from "../src/lib/snapshots/repository";
import { createSupabaseServerClient, isSupabaseConfigured } from "../src/lib/supabase/server";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

async function probeSubscriberCountColumn(): Promise<"present" | "missing"> {
  const supabase = createSupabaseServerClient();
  const probe = await supabase.from("video_snapshots").select("subscriber_count").limit(1);
  if (probe.error?.code === "42703" || probe.error?.message?.includes("subscriber_count")) {
    return "missing";
  }
  if (probe.error) {
    throw new Error(`subscriber_count probe failed: ${probe.error.message}`);
  }
  return "present";
}

async function findSampleVideoWithMultipleSnapshots(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("video_snapshots").select("video_id").limit(500);
  if (error) {
    throw new Error(`sample video lookup failed: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.video_id, (counts.get(row.video_id) ?? 0) + 1);
  }

  const candidate = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])[0];

  return candidate?.[0] ?? null;
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "measurement";

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  console.log(`=== Snapshot Verify (${mode}) ===`);
  console.log(`subscriber_count column: ${await probeSubscriberCountColumn()}`);

  if (mode === "collect") {
    console.log(await collectVideoSnapshots());
  } else if (mode === "measurement") {
    console.log(await runMeasurement());
  } else if (mode === "status") {
    console.log({
      totalSnapshots: await countVideoSnapshots(),
      subscriberCountSavedTotal: await countVideoSnapshotsWithSubscriberCount(),
      videosWithMultipleSnapshots: await countVideosWithMultipleSnapshots(),
      latestCapturedAt: await getLatestVideoSnapshotCapturedAt(),
    });
  } else {
    throw new Error(`Unknown mode: ${mode}. Use collect | measurement | status`);
  }

  const latestCapturedAt = await getLatestVideoSnapshotCapturedAt();
  const totalSnapshots = await countVideoSnapshots();
  const multiSnapshotVideos = await countVideosWithMultipleSnapshots();
  const subscriberCountSavedTotal = await countVideoSnapshotsWithSubscriberCount();

  console.log("\n=== Snapshot Summary ===");
  console.log(
    JSON.stringify(
      {
        totalSnapshots,
        subscriberCountSavedTotal,
        videosWithMultipleSnapshots: multiSnapshotVideos,
        latestCapturedAt,
        latestCapturedAtJst: latestCapturedAt
          ? new Date(latestCapturedAt).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })
          : null,
      },
      null,
      2,
    ),
  );

  const sampleVideoId =
    process.env.SNAPSHOT_VERIFY_VIDEO_ID ?? (await findSampleVideoWithMultipleSnapshots());
  if (sampleVideoId) {
    const snapshots = await fetchSnapshotsForVideo(sampleVideoId);
    const latestGrowth = computeLatestSnapshotGrowth(snapshots);
    const series = computeSnapshotGrowthSeries(snapshots);

    console.log(`\n=== Growth Sample (${sampleVideoId}) ===`);
    console.log(
      JSON.stringify(
        {
          snapshotCount: snapshots.length,
          latestGrowth,
          seriesLength: series.length,
          latestSnapshot: snapshots.at(-1) ?? null,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `\nNo video with 2+ snapshots found. Set SNAPSHOT_VERIFY_VIDEO_ID in .env.local to inspect growth.`,
    );
  }

  console.log(`\nProject root: ${projectRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
