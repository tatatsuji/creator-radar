import { randomUUID } from "node:crypto";

import { buildWebsubSourceKey } from "@/lib/discovery/sourceKey";
import {
  buildChannelUpsertFromYouTube,
  buildVideoUpsertFromYouTubeItem,
} from "@/lib/discovery/parseYouTubeVideoForStorage";
import {
  registerDiscoveryCandidate,
  type RegisterDiscoveryCandidateInput,
  type RegisterDiscoveryCandidateResult,
} from "@/lib/discovery/registerDiscoveryCandidate";
import { enqueueDeferredQuotaOperation } from "@/lib/quota/quotaDeferredQueue";
import { requestQuotaAuthorization } from "@/lib/quota/quotaGatedCron";
import { QUOTA_OPERATION_PRIORITY } from "@/lib/quota/quotaManagerConfig";
import { findExistingVideoIds } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { YouTubeVideoItem } from "@/lib/youtube/types";
import { isWebsubEnabled, WEBSUB_CONFIG } from "@/lib/websub/websubConfig";
import {
  claimWebsubNotifications,
  completeWebsubNotification,
  reclaimStaleWebsubNotifications,
  releaseWebsubNotificationsToPending,
  type CompleteWebsubNotificationInput,
  type WebsubNotificationRow,
} from "@/lib/websub/websubNotificationRepository";
import { fetchWebsubVideoDetailsBatch } from "@/lib/websub/websubVideoFetch";

export interface WebsubNotificationWorkerResult {
  status: "executed" | "skipped";
  reclaimed: number;
  batchesProcessed: number;
  claimed: number;
  skippedKnown: number;
  processed: number;
  duplicate: number;
  failed: number;
  releasedToPending: number;
  quotaDeferred: boolean;
  quotaReason?: string;
}

export interface WebsubNotificationWorkerDeps {
  isEnabled: () => boolean;
  isSupabaseReady: () => boolean;
  reclaimStale: () => Promise<number>;
  claim: (
    workerId: string,
    batchSize: number,
    processingLeaseSeconds: number,
  ) => Promise<WebsubNotificationRow[]>;
  findExistingVideoIds: (videoIds: string[]) => Promise<Set<string>>;
  complete: (input: CompleteWebsubNotificationInput) => Promise<void>;
  releaseToPending: (notificationIds: string[]) => Promise<void>;
  requestQuota: (estimatedUnits: number) => Promise<{
    decision: "allow" | "defer";
    reason: string;
    retryAfter?: string;
  }>;
  enqueueDeferred: (input: {
    estimatedUnits: number;
    reason: string;
    retryAfter?: Date;
    payload?: Record<string, unknown>;
  }) => Promise<string | null>;
  fetchVideos: (videoIds: string[]) => Promise<YouTubeVideoItem[]>;
  registerDiscoveryCandidate: (
    input: RegisterDiscoveryCandidateInput,
  ) => Promise<RegisterDiscoveryCandidateResult>;
  createWorkerId: () => string;
  config: {
    workerBatchSize: number;
    workerMaxBatchesPerRun: number;
    workerProcessingLeaseSeconds: number;
  };
}

const defaultDeps: WebsubNotificationWorkerDeps = {
  isEnabled: isWebsubEnabled,
  isSupabaseReady: isSupabaseConfigured,
  reclaimStale: reclaimStaleWebsubNotifications,
  claim: (workerId, batchSize, processingLeaseSeconds) =>
    claimWebsubNotifications({
      workerId,
      batchSize,
      processingLeaseSeconds,
    }),
  findExistingVideoIds,
  complete: completeWebsubNotification,
  releaseToPending: releaseWebsubNotificationsToPending,
  requestQuota: async (estimatedUnits) =>
    requestQuotaAuthorization({
      operationType: "emergency_discovery",
      estimatedUnits,
    }),
  enqueueDeferred: async (input) =>
    enqueueDeferredQuotaOperation({
      operationType: "emergency_discovery",
      estimatedUnits: input.estimatedUnits,
      priority: QUOTA_OPERATION_PRIORITY.emergency_discovery,
      reason: input.reason,
      payload: input.payload,
      retryAfter: input.retryAfter,
    }),
  fetchVideos: fetchWebsubVideoDetailsBatch,
  registerDiscoveryCandidate,
  createWorkerId: () => `websub-worker-${randomUUID()}`,
  config: {
    workerBatchSize: WEBSUB_CONFIG.workerBatchSize,
    workerMaxBatchesPerRun: WEBSUB_CONFIG.workerMaxBatchesPerRun,
    workerProcessingLeaseSeconds: WEBSUB_CONFIG.workerProcessingLeaseSeconds,
  },
};

function createEmptyResult(
  status: WebsubNotificationWorkerResult["status"],
): WebsubNotificationWorkerResult {
  return {
    status,
    reclaimed: 0,
    batchesProcessed: 0,
    claimed: 0,
    skippedKnown: 0,
    processed: 0,
    duplicate: 0,
    failed: 0,
    releasedToPending: 0,
    quotaDeferred: false,
  };
}

async function partitionKnownNotifications(
  notifications: WebsubNotificationRow[],
  findExisting: (videoIds: string[]) => Promise<Set<string>>,
): Promise<{
  known: WebsubNotificationRow[];
  unknown: WebsubNotificationRow[];
}> {
  const existingVideoIds = await findExisting(
    notifications.map((notification) => notification.youtube_video_id),
  );

  return {
    known: notifications.filter((notification) =>
      existingVideoIds.has(notification.youtube_video_id),
    ),
    unknown: notifications.filter(
      (notification) => !existingVideoIds.has(notification.youtube_video_id),
    ),
  };
}

async function completeKnownNotifications(
  known: WebsubNotificationRow[],
  complete: WebsubNotificationWorkerDeps["complete"],
): Promise<number> {
  for (const notification of known) {
    await complete({
      id: notification.id,
      status: "skipped_known",
      quotaUnitsUsed: 0,
    });
  }

  return known.length;
}

async function processUnknownNotifications(input: {
  unknown: WebsubNotificationRow[];
  deps: WebsubNotificationWorkerDeps;
  counters: Pick<
    WebsubNotificationWorkerResult,
    "processed" | "duplicate" | "failed"
  >;
}): Promise<void> {
  const { unknown, deps, counters } = input;
  const now = new Date().toISOString();

  let videoItems: YouTubeVideoItem[];
  try {
    videoItems = await deps.fetchVideos(
      unknown.map((notification) => notification.youtube_video_id),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "videos.list request failed";

    for (const notification of unknown) {
      await deps.complete({
        id: notification.id,
        status: "failed",
        errorMessage: message,
      });
      counters.failed += 1;
    }
    return;
  }

  const videoItemsById = new Map(
    videoItems.map((item) => [item.id, item] as const),
  );

  for (const notification of unknown) {
    const item = videoItemsById.get(notification.youtube_video_id);
    if (!item) {
      await deps.complete({
        id: notification.id,
        status: "failed",
        errorMessage: "video not found in videos.list response",
      });
      counters.failed += 1;
      continue;
    }

    try {
      const registration = await deps.registerDiscoveryCandidate({
        video: buildVideoUpsertFromYouTubeItem({
          item,
          lastSeenAt: now,
        }),
        channel: buildChannelUpsertFromYouTube(
          undefined,
          notification.youtube_channel_id,
          item.snippet.channelTitle ?? notification.youtube_channel_id,
        ),
        sourceType: "websub",
        sourceKey: buildWebsubSourceKey(
          notification.youtube_channel_id,
          notification.youtube_video_id,
        ),
        metadata: {
          topicUrl: notification.topic_url,
          entryUpdatedAt: notification.entry_updated_at,
          hubNotificationId: notification.hub_notification_id,
        },
        registrationPath: "websub_notification",
      });

      if (registration.discoveryInserted) {
        await deps.complete({
          id: notification.id,
          status: "processed",
          quotaUnitsUsed: 1,
        });
        counters.processed += 1;
      } else {
        await deps.complete({
          id: notification.id,
          status: "duplicate",
          quotaUnitsUsed: 1,
        });
        counters.duplicate += 1;
      }
    } catch (error) {
      await deps.complete({
        id: notification.id,
        status: "failed",
        quotaUnitsUsed: 1,
        errorMessage:
          error instanceof Error
            ? error.message
            : "registerDiscoveryCandidate failed",
      });
      counters.failed += 1;
    }
  }
}

export async function runWebsubNotificationWorker(
  deps: Partial<WebsubNotificationWorkerDeps> = {},
): Promise<WebsubNotificationWorkerResult> {
  const resolvedDeps: WebsubNotificationWorkerDeps = {
    ...defaultDeps,
    ...deps,
    config: {
      ...defaultDeps.config,
      ...deps.config,
    },
  };

  if (!resolvedDeps.isEnabled()) {
    return createEmptyResult("skipped");
  }

  if (!resolvedDeps.isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const result = createEmptyResult("executed");
  result.reclaimed = await resolvedDeps.reclaimStale();

  const workerId = resolvedDeps.createWorkerId();

  for (
    let batchIndex = 0;
    batchIndex < resolvedDeps.config.workerMaxBatchesPerRun;
    batchIndex += 1
  ) {
    const claimed = await resolvedDeps.claim(
      workerId,
      resolvedDeps.config.workerBatchSize,
      resolvedDeps.config.workerProcessingLeaseSeconds,
    );

    if (claimed.length === 0) {
      break;
    }

    result.batchesProcessed += 1;
    result.claimed += claimed.length;

    const { known, unknown } = await partitionKnownNotifications(
      claimed,
      resolvedDeps.findExistingVideoIds,
    );

    result.skippedKnown += await completeKnownNotifications(
      known,
      resolvedDeps.complete,
    );

    if (unknown.length === 0) {
      continue;
    }

    const authorization = await resolvedDeps.requestQuota(unknown.length);
    if (authorization.decision === "defer") {
      const unknownIds = unknown.map((notification) => notification.id);
      await resolvedDeps.releaseToPending(unknownIds);
      await resolvedDeps.enqueueDeferred({
        estimatedUnits: unknown.length,
        reason: authorization.reason,
        retryAfter: authorization.retryAfter
          ? new Date(authorization.retryAfter)
          : undefined,
        payload: {
          source: "websub_notification_worker",
          unknownCount: unknown.length,
        },
      });

      result.releasedToPending += unknown.length;
      result.quotaDeferred = true;
      result.quotaReason = authorization.reason;
      break;
    }

    await processUnknownNotifications({
      unknown,
      deps: resolvedDeps,
      counters: result,
    });
  }

  return result;
}
