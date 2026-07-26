#!/usr/bin/env node

import { forceDevRemeasureDueNow } from "../src/lib/measurement/forceDevRemeasure";
import { runMeasurement } from "../src/lib/measurement/runMeasurement";
import {
  countVideoSnapshots,
  countVideoSnapshotsSince,
  countVideoSnapshotsWithSubscriberCount,
  getLatestVideoSnapshotCapturedAt,
} from "../src/lib/snapshots/repository";
import { isSupabaseConfigured } from "../src/lib/supabase/server";

async function main(): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const dryRun = process.argv.includes("--dry-run");
  const beforeTotal = await countVideoSnapshots();
  const beforeWithSubscriber = await countVideoSnapshotsWithSubscriberCount();
  const beforeLatestCapturedAt = await getLatestVideoSnapshotCapturedAt();
  const startedAt = new Date().toISOString();

  console.log("=== Dev Force Measurement ===");
  console.log(
    JSON.stringify(
      {
        dryRun,
        beforeTotal,
        beforeWithSubscriber,
        beforeLatestCapturedAt,
      },
      null,
      2,
    ),
  );

  const reset = await forceDevRemeasureDueNow();
  console.log("\n--- Schedules reset to due now ---");
  console.log(JSON.stringify(reset, null, 2));

  if (dryRun) {
    console.log("\nDry run complete. Re-run without --dry-run to execute measurement.");
    return;
  }

  if (reset.updated === 0) {
    console.log("\nNo schedules needed reset. Running measurement anyway.");
  }

  const result = await runMeasurement();
  console.log("\n--- Measurement result ---");
  console.log(JSON.stringify(result, null, 2));

  const afterTotal = await countVideoSnapshots();
  const afterWithSubscriber = await countVideoSnapshotsWithSubscriberCount();
  const afterLatestCapturedAt = await getLatestVideoSnapshotCapturedAt();
  const newSnapshotsSinceRun = await countVideoSnapshotsSince(startedAt);

  console.log("\n--- After run ---");
  console.log(
    JSON.stringify(
      {
        totalSnapshots: afterTotal,
        subscriberCountSavedTotal: afterWithSubscriber,
        newSnapshotsInserted: afterTotal - beforeTotal,
        newSnapshotsSinceRun,
        newSubscriberCountRows: afterWithSubscriber - beforeWithSubscriber,
        latestCapturedAt: afterLatestCapturedAt,
        latestCapturedAtJst: afterLatestCapturedAt
          ? new Date(afterLatestCapturedAt).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })
          : null,
      },
      null,
      2,
    ),
  );

  if (result.videosFailed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
