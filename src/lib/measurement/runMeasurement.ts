import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  acquireMeasurementLocks,
  getDueVideos,
  incrementFailureCount,
  markMeasurementFailure,
  markMeasurementSuccess,
  releaseMeasurementLock,
  type MeasurementLockHandle,
} from "@/lib/measurement/scheduleRepository";
import {
  fetchChannelSubscriberCountsBatch,
  fetchVideoStatisticsBatch,
} from "@/lib/measurement/youtubeStats";
import {
  createMeasurementSnapshotRun,
  fetchChannelIdsForVideos,
  findRecentRunningMeasurementRun,
  finishSnapshotRun,
  fillVideoSnapshotSubscriberCountIfNull,
  insertVideoSnapshotRaw,
  updateVideoLastObservedAt,
} from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { MeasurementScheduleRow } from "@/types/database";
import type { MeasurementTier } from "@/types/observability";
import { isMeasurementTier } from "@/types/observability";

export interface MeasurementRunResult {
  runId: string;
  status: "success" | "partial" | "failed";
  videosDue: number;
  videosLocked: number;
  videosRequested: number;
  snapshotsInserted: number;
  videosSucceeded: number;
  videosFailed: number;
  notFound: number;
  youtubeQuotaEstimate: number;
  startedAt: string;
  finishedAt: string;
  errors: Array<{ videoId: string; reason: string }>;
}

export interface MeasurementDeps {
  getDueVideos: typeof getDueVideos;
  acquireLocks: typeof acquireMeasurementLocks;
  releaseLock: typeof releaseMeasurementLock;
  fetchStatistics: typeof fetchVideoStatisticsBatch;
  fetchChannelIdsForVideos: typeof fetchChannelIdsForVideos;
  fetchChannelSubscriberCounts: typeof fetchChannelSubscriberCountsBatch;
  insertSnapshot: typeof insertVideoSnapshotRaw;
  fillSubscriberCountIfNull: typeof fillVideoSnapshotSubscriberCountIfNull;
  updateLastObservedAt: typeof updateVideoLastObservedAt;
  markSuccess: typeof markMeasurementSuccess;
  markFailure: typeof markMeasurementFailure;
  incrementFailure: typeof incrementFailureCount;
  findRunningRun: typeof findRecentRunningMeasurementRun;
  createRun: typeof createMeasurementSnapshotRun;
  finishRun: typeof finishSnapshotRun;
}

const defaultDeps: MeasurementDeps = {
  getDueVideos,
  acquireLocks: acquireMeasurementLocks,
  releaseLock: releaseMeasurementLock,
  fetchStatistics: fetchVideoStatisticsBatch,
  fetchChannelIdsForVideos,
  fetchChannelSubscriberCounts: fetchChannelSubscriberCountsBatch,
  insertSnapshot: insertVideoSnapshotRaw,
  fillSubscriberCountIfNull: fillVideoSnapshotSubscriberCountIfNull,
  updateLastObservedAt: updateVideoLastObservedAt,
  markSuccess: markMeasurementSuccess,
  markFailure: markMeasurementFailure,
  incrementFailure: incrementFailureCount,
  findRunningRun: findRecentRunningMeasurementRun,
  createRun: createMeasurementSnapshotRun,
  finishRun: finishSnapshotRun,
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function processNotFoundVideo(
  videoId: string,
  currentFailureCount: number,
  measuredAt: Date,
  deps: MeasurementDeps,
  errors: MeasurementRunResult["errors"],
): Promise<void> {
  const nextFailureCount = currentFailureCount + 1;
  await deps.markFailure(videoId, {
    failureCount: nextFailureCount,
    reason: "not_found",
    measuredAt,
  });
  errors.push({ videoId, reason: "not_found" });
}

async function processSuccessfulVideo(
  schedule: MeasurementScheduleRow,
  stats: {
    viewCount: number;
    likeCount: number | null;
    commentCount: number | null;
  },
  subscriberCount: number | null,
  capturedAt: string,
  measuredAt: Date,
  insertedInRun: Set<string>,
  deps: MeasurementDeps,
): Promise<"inserted" | "skipped" | "duplicate_in_run"> {
  if (insertedInRun.has(schedule.video_id)) {
    return "duplicate_in_run";
  }

  const snapshotResult = await deps.insertSnapshot({
    videoId: schedule.video_id,
    viewCount: stats.viewCount,
    likeCount: stats.likeCount,
    commentCount: stats.commentCount,
    subscriberCount,
    capturedAt,
  });

  if (snapshotResult === "inserted") {
    insertedInRun.add(schedule.video_id);
  } else if (snapshotResult === "skipped" && subscriberCount !== null) {
    await deps.fillSubscriberCountIfNull(
      schedule.video_id,
      subscriberCount,
      capturedAt,
    );
  }

  await deps.updateLastObservedAt(schedule.video_id, measuredAt.toISOString());

  const tier = isMeasurementTier(schedule.measurement_tier)
    ? schedule.measurement_tier
    : ("hot" satisfies MeasurementTier);

  await deps.markSuccess(schedule.video_id, tier, measuredAt);
  return snapshotResult === "inserted" ? "inserted" : "skipped";
}

export async function runMeasurement(
  deps: MeasurementDeps = defaultDeps,
): Promise<MeasurementRunResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const running = await deps.findRunningRun();
  if (running) {
    throw new Error("Measurement is already in progress.");
  }

  const startedAt = new Date();
  const capturedAt = startedAt.toISOString();
  const dueSchedules = await deps.getDueVideos(
    OBSERVABILITY_CONFIG.batchSize.measurement,
  );
  const dueVideoIds = dueSchedules.map((schedule) => schedule.video_id);
  const { locked, skipped } = await deps.acquireLocks(dueVideoIds);

  const scheduleByVideoId = new Map(
    dueSchedules.map((schedule) => [schedule.video_id, schedule]),
  );
  const lockedHandles: MeasurementLockHandle[] = locked;
  const lockedVideoIds = locked.map((handle) => handle.videoId);

  const runId = await deps.createRun();
  const insertedInRun = new Set<string>();
  const channelIdsByVideoId = await deps.fetchChannelIdsForVideos(lockedVideoIds);
  const uniqueChannelIds = [
    ...new Set(
      [...channelIdsByVideoId.values()].filter(
        (channelId): channelId is string => Boolean(channelId),
      ),
    ),
  ];
  const subscriberCountByChannelId = new Map<string, number | null>();
  let snapshotsInserted = 0;
  let videosSucceeded = 0;
  let videosFailed = 0;
  let notFound = 0;
  let youtubeQuotaEstimate = 0;
  const errors: MeasurementRunResult["errors"] = [];

  if (uniqueChannelIds.length > 0) {
    const { subscriberCounts, quotaUsed: channelQuotaUsed } =
      await deps.fetchChannelSubscriberCounts(uniqueChannelIds);
    youtubeQuotaEstimate += channelQuotaUsed;
    for (const [channelId, subscriberCount] of subscriberCounts) {
      subscriberCountByChannelId.set(channelId, subscriberCount);
    }
  }

  try {
    for (const batch of chunk(lockedVideoIds, OBSERVABILITY_CONFIG.batchSize.measurement)) {
      const { statistics, quotaUsed } = await deps.fetchStatistics(batch);
      youtubeQuotaEstimate += quotaUsed;

      const statsByVideoId = new Map(
        statistics.map((entry) => [entry.videoId, entry]),
      );

      for (const videoId of batch) {
        const schedule = scheduleByVideoId.get(videoId);
        if (!schedule) {
          continue;
        }

        const stats = statsByVideoId.get(videoId);
        if (!stats) {
          notFound += 1;
          videosFailed += 1;
          await processNotFoundVideo(
            videoId,
            schedule.failure_count,
            startedAt,
            deps,
            errors,
          );
          continue;
        }

        try {
          const channelId = channelIdsByVideoId.get(videoId) ?? null;
          const subscriberCount = channelId
            ? (subscriberCountByChannelId.get(channelId) ?? null)
            : null;
          const snapshotResult = await processSuccessfulVideo(
            schedule,
            stats,
            subscriberCount,
            capturedAt,
            startedAt,
            insertedInRun,
            deps,
          );

          if (snapshotResult === "inserted") {
            snapshotsInserted += 1;
          }
          videosSucceeded += 1;
        } catch (error) {
          videosFailed += 1;
          const nextFailureCount = await deps.incrementFailure(videoId);
          await deps.markFailure(videoId, {
            failureCount: nextFailureCount,
            reason: "api_error",
            measuredAt: startedAt,
          });
          errors.push({
            videoId,
            reason:
              error instanceof Error ? error.message : "measurement_failed",
          });
        }
      }
    }

    for (const handle of lockedHandles) {
      await deps.releaseLock(handle).catch(() => undefined);
    }

    for (const videoId of skipped) {
      errors.push({ videoId, reason: "lock_unavailable" });
    }

    const finishedAt = new Date();
    const status =
      videosFailed === 0
        ? "success"
        : videosSucceeded > 0
          ? "partial"
          : "failed";

    await deps.finishRun(runId, {
      status,
      videosTotal: dueSchedules.length,
      videosSuccess: videosSucceeded,
      videosFailed,
      videosSkipped: notFound,
      channelsTotal: 0,
      channelsSuccess: 0,
      channelsSkipped: 0,
      youtubeQuotaUsed: youtubeQuotaEstimate,
      errorSummary: JSON.stringify({
        type: "measurement",
        videosDue: dueSchedules.length,
        videosLocked: locked.length,
        videosRequested: lockedVideoIds.length,
        snapshotsInserted,
        notFound,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        errors: errors.slice(0, 20),
      }),
    });

    return {
      runId,
      status,
      videosDue: dueSchedules.length,
      videosLocked: locked.length,
      videosRequested: lockedVideoIds.length,
      snapshotsInserted,
      videosSucceeded,
      videosFailed,
      notFound,
      youtubeQuotaEstimate,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      errors,
    };
  } catch (error) {
    for (const handle of lockedHandles) {
      await deps.releaseLock(handle).catch(() => undefined);
    }

    await deps.finishRun(runId, {
      status: "failed",
      videosTotal: dueSchedules.length,
      videosSuccess: videosSucceeded,
      videosFailed,
      videosSkipped: notFound,
      channelsTotal: 0,
      channelsSuccess: 0,
      channelsSkipped: 0,
      youtubeQuotaUsed: youtubeQuotaEstimate,
      errorSummary:
        error instanceof Error ? error.message : "Measurement run failed",
    });
    throw error;
  }
}
