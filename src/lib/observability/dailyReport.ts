import {
  countFailedMeasurementSchedules,
  getMeasurementScheduleSummary,
  listScheduledVideoIds,
} from "@/lib/measurement/scheduleRepository";
import { getLatestDiscoveryRun } from "@/lib/discovery/runsRepository";
import { buildPipelineHealthFromRuns } from "@/lib/observability/health";
import { analyzeVideoVelocity } from "@/lib/observability/velocity";
import {
  computeMaxSnapshotGapHours,
  countVideoSnapshotsSince,
  countVideosWithSnapshotCountAtLeast,
  fetchSnapshotsForVideos,
  getLatestMeasurementRun,
  getLatestVideoSnapshotCapturedAt,
  listMeasurementRunsSince,
} from "@/lib/snapshots/repository";

export interface DailyVideoSample {
  videoId: string;
  firstCapturedAt: string;
  lastCapturedAt: string;
  elapsedHours: number;
  viewCountDelta: number;
  viewsPerHour: number;
}

export interface DailyReport {
  measuredVideoCount: number;
  measurementRunsLast24Hours: number;
  successfulRuns: number;
  failedRuns: number;
  snapshotsAddedLast24Hours: number;
  videosWithTwoOrMoreSnapshots: number;
  videosWithThreeOrMoreSnapshots: number;
  latestSnapshotAt: string | null;
  maxSnapshotGapHours: number | null;
  activeLockCount: number;
  failedScheduleCount: number;
  youtubeQuotaEstimateLast24Hours: number;
  health: ReturnType<typeof buildPipelineHealthFromRuns>;
  duplicateSnapshotAnomalies: number;
  videoSamples: DailyVideoSample[];
  phase3Readiness: {
    measurementSuccessRate: number | null;
    targetVideosWithTwoSnapshotsRatio: number | null;
    readyForPhase3: boolean;
    blockers: string[];
  };
  generatedAt: string;
}

function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / (60 * 60 * 1000);
}

function countDuplicateHourBuckets(
  snapshots: Array<{ captured_at: string }>,
): number {
  const buckets = new Set<string>();
  let duplicates = 0;
  for (const snapshot of snapshots) {
    const bucket = snapshot.captured_at.slice(0, 13);
    if (buckets.has(bucket)) {
      duplicates += 1;
    } else {
      buckets.add(bucket);
    }
  }
  return duplicates;
}

export async function buildDailyReport(
  now: Date = new Date(),
): Promise<DailyReport> {
  const since24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const scheduledVideoIds = await listScheduledVideoIds();

  const [
    measurementSummary,
    failedScheduleCount,
    runs,
    snapshotsAddedLast24Hours,
    videosWithTwoOrMoreSnapshots,
    videosWithThreeOrMoreSnapshots,
    latestSnapshotAt,
    maxSnapshotGapHours,
    latestMeasurementRun,
    latestDiscoveryRun,
  ] = await Promise.all([
    getMeasurementScheduleSummary(),
    countFailedMeasurementSchedules(),
    listMeasurementRunsSince(since24Hours),
    countVideoSnapshotsSince(since24Hours),
    countVideosWithSnapshotCountAtLeast(2, scheduledVideoIds),
    countVideosWithSnapshotCountAtLeast(3, scheduledVideoIds),
    getLatestVideoSnapshotCapturedAt(),
    computeMaxSnapshotGapHours(scheduledVideoIds),
    getLatestMeasurementRun(),
    getLatestDiscoveryRun(),
  ]);

  const finishedRuns = runs.filter((run) => run.status !== "running");
  const successfulRuns = finishedRuns.filter(
    (run) => run.status === "success" || run.status === "partial",
  ).length;
  const failedRuns = finishedRuns.filter((run) => run.status === "failed").length;
  const measurementSuccessRate =
    finishedRuns.length > 0 ? successfulRuns / finishedRuns.length : null;

  const snapshotsByVideo = await fetchSnapshotsForVideos(scheduledVideoIds);
  let duplicateSnapshotAnomalies = 0;
  const videoSamples: DailyVideoSample[] = [];

  for (const videoId of scheduledVideoIds.slice(0, 10)) {
    const snapshots = snapshotsByVideo.get(videoId) ?? [];
    duplicateSnapshotAnomalies += countDuplicateHourBuckets(snapshots);

    if (snapshots.length < 2) {
      continue;
    }

    const first = snapshots[0];
    const last = snapshots.at(-1)!;
    const elapsedHours = hoursBetween(first.captured_at, last.captured_at);
    const viewCountDelta = last.view_count - first.view_count;

    videoSamples.push({
      videoId,
      firstCapturedAt: first.captured_at,
      lastCapturedAt: last.captured_at,
      elapsedHours,
      viewCountDelta,
      viewsPerHour: elapsedHours > 0 ? viewCountDelta / elapsedHours : 0,
    });
  }

  videoSamples.sort((left, right) => right.viewsPerHour - left.viewsPerHour);

  const health = buildPipelineHealthFromRuns({
    latestDiscoveryRun,
    latestMeasurementRun,
    latestSnapshotCapturedAt: latestSnapshotAt,
    dueMeasurementCount: measurementSummary.dueNow,
    activeLockCount: measurementSummary.activeLocks,
    nowMs: now.getTime(),
  });

  const targetVideosWithTwoSnapshotsRatio =
    scheduledVideoIds.length > 0
      ? videosWithTwoOrMoreSnapshots / scheduledVideoIds.length
      : null;

  const blockers: string[] = [];
  if (measurementSuccessRate !== null && measurementSuccessRate < 0.95) {
    blockers.push("measurement_success_rate_below_95_percent");
  }
  if (measurementSummary.activeLocks > 0) {
    blockers.push("active_locks_present");
  }
  if (failedScheduleCount > 0) {
    blockers.push("failed_schedules_present");
  }
  if (
    targetVideosWithTwoSnapshotsRatio !== null &&
    targetVideosWithTwoSnapshotsRatio < 0.8
  ) {
    blockers.push("insufficient_multi_snapshot_coverage");
  }
  if (
    latestSnapshotAt &&
    now.getTime() - Date.parse(latestSnapshotAt) > 2 * 60 * 60 * 1000
  ) {
    blockers.push("latest_snapshot_older_than_2_hours");
  }
  if (health.measurement !== "healthy") {
    blockers.push(`health_measurement_${health.measurement}`);
  }
  if (duplicateSnapshotAnomalies > 0) {
    blockers.push("duplicate_snapshot_anomalies");
  }

  return {
    measuredVideoCount: scheduledVideoIds.length,
    measurementRunsLast24Hours: runs.length,
    successfulRuns,
    failedRuns,
    snapshotsAddedLast24Hours,
    videosWithTwoOrMoreSnapshots,
    videosWithThreeOrMoreSnapshots,
    latestSnapshotAt,
    maxSnapshotGapHours,
    activeLockCount: measurementSummary.activeLocks,
    failedScheduleCount,
    youtubeQuotaEstimateLast24Hours: runs.reduce(
      (total, run) => total + (run.youtube_quota_used ?? 0),
      0,
    ),
    health,
    duplicateSnapshotAnomalies,
    videoSamples: videoSamples.slice(0, 10),
    phase3Readiness: {
      measurementSuccessRate,
      targetVideosWithTwoSnapshotsRatio,
      readyForPhase3: blockers.length === 0,
      blockers,
    },
    generatedAt: now.toISOString(),
  };
}

export async function buildDailyVelocitySamples(limit = 10) {
  const scheduledVideoIds = await listScheduledVideoIds();
  const snapshotsByVideo = await fetchSnapshotsForVideos(
    scheduledVideoIds.slice(0, limit),
  );

  return [...snapshotsByVideo.entries()].map(([videoId, snapshots]) =>
    analyzeVideoVelocity(videoId, snapshots),
  );
}