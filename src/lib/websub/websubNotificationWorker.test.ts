import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RegisterDiscoveryCandidateResult } from "@/lib/discovery/registerDiscoveryCandidate";
import type { YouTubeVideoItem } from "@/lib/youtube/types";
import {
  runWebsubNotificationWorker,
  type WebsubNotificationWorkerDeps,
} from "@/lib/websub/websubNotificationWorker";
import type { WebsubNotificationRow } from "@/lib/websub/websubNotificationRepository";

const CHANNEL_ID = "UC1234567890abcdefghij";
const TOPIC_URL = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const VIDEO_ID = "dQw4w9WgXcQ";
const VIDEO_ID_2 = "abc12345678";

function makeNotification(
  overrides: Partial<WebsubNotificationRow> = {},
): WebsubNotificationRow {
  const youtubeVideoId = overrides.youtube_video_id ?? VIDEO_ID;

  return {
    id: overrides.id ?? `notif-${youtubeVideoId}`,
    subscription_id: null,
    dedup_key: `${TOPIC_URL}::${youtubeVideoId}`,
    topic_url: TOPIC_URL,
    youtube_video_id: youtubeVideoId,
    youtube_channel_id: CHANNEL_ID,
    entry_updated_at: "2026-07-31T12:00:00+00:00",
    hub_notification_id: "yt:video:entry",
    status: "processing",
    received_at: "2026-07-31T12:00:00+00:00",
    processed_at: null,
    processing_owner: "websub-worker-test",
    processing_expires_at: "2026-07-31T12:10:00+00:00",
    attempt_count: 0,
    max_attempts: 5,
    quota_units_used: 0,
    discovery_run_id: null,
    error_message: null,
    created_at: "2026-07-31T12:00:00+00:00",
    updated_at: "2026-07-31T12:00:00+00:00",
    ...overrides,
  };
}

function makeVideoItem(videoId: string): YouTubeVideoItem {
  return {
    id: videoId,
    snippet: {
      title: "Test Video",
      description: "Description",
      publishedAt: "2026-07-31T12:00:00+00:00",
      channelId: CHANNEL_ID,
      channelTitle: "Test Channel",
      thumbnails: {
        default: { url: "https://example.com/thumb.jpg", width: 120, height: 90 },
      },
    },
    statistics: {
      viewCount: "100",
      likeCount: "10",
      commentCount: "1",
    },
    contentDetails: {
      duration: "PT5M",
    },
  };
}

function claimOnce(notifications: WebsubNotificationRow[]) {
  return vi
    .fn()
    .mockResolvedValueOnce(notifications)
    .mockResolvedValue([]);
}

function createDeps(
  overrides: Partial<WebsubNotificationWorkerDeps> = {},
): WebsubNotificationWorkerDeps {
  return {
    isEnabled: vi.fn(() => true),
    isSupabaseReady: vi.fn(() => true),
    reclaimStale: vi.fn(async () => 0),
    claim: vi.fn(async () => []),
    findExistingVideoIds: vi.fn(async (): Promise<Set<string>> => new Set()),
    complete: vi.fn(async () => undefined),
    releaseToPending: vi.fn(async () => undefined),
    requestQuota: vi.fn(async () => ({
      decision: "allow" as const,
      reason: "ok",
    })),
    enqueueDeferred: vi.fn(async () => "deferred-1"),
    fetchVideos: vi.fn(async () => [makeVideoItem(VIDEO_ID)]),
    registerDiscoveryCandidate: vi.fn(
      async (): Promise<RegisterDiscoveryCandidateResult> => ({
        videoInserted: true,
        discoveryInserted: true,
        scheduleCreated: true,
      }),
    ),
    createWorkerId: vi.fn(() => "websub-worker-test"),
    config: {
      workerBatchSize: 2,
      workerMaxBatchesPerRun: 4,
      workerProcessingLeaseSeconds: 600,
    },
    ...overrides,
  };
}

describe("runWebsubNotificationWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not run when WebSub is disabled", async () => {
    const deps = createDeps({
      isEnabled: vi.fn(() => false),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.status).toBe("skipped");
    expect(deps.reclaimStale).not.toHaveBeenCalled();
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it("reclaims stale notifications before claiming", async () => {
    const deps = createDeps({
      reclaimStale: vi.fn(async () => 3),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(deps.reclaimStale).toHaveBeenCalledTimes(1);
    expect(result.reclaimed).toBe(3);
  });

  it("claims notifications with processing lease settings", async () => {
    const deps = createDeps({
      claim: vi.fn(async () => []),
    });

    await runWebsubNotificationWorker(deps);

    expect(deps.claim).toHaveBeenCalledWith("websub-worker-test", 2, 600);
  });

  it("skips known videos before quota and API calls", async () => {
    const knownNotification = makeNotification({ id: "known-1" });
    const deps = createDeps({
      claim: claimOnce([knownNotification]),
      findExistingVideoIds: vi.fn(async () => new Set([VIDEO_ID])),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.skippedKnown).toBe(1);
    expect(deps.requestQuota).not.toHaveBeenCalled();
    expect(deps.fetchVideos).not.toHaveBeenCalled();
    expect(deps.complete).toHaveBeenCalledWith({
      id: "known-1",
      status: "skipped_known",
      quotaUnitsUsed: 0,
    });
  });

  it("releases unknown notifications to pending when quota is insufficient", async () => {
    const unknownNotification = makeNotification({ id: "unknown-1" });
    const deps = createDeps({
      claim: claimOnce([unknownNotification]),
      requestQuota: vi.fn(async () => ({
        decision: "defer" as const,
        reason: "insufficient_dynamic_budget",
        retryAfter: "2026-07-31T13:00:00.000Z",
      })),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.quotaDeferred).toBe(true);
    expect(result.releasedToPending).toBe(1);
    expect(result.failed).toBe(0);
    expect(deps.releaseToPending).toHaveBeenCalledWith(["unknown-1"]);
    expect(deps.enqueueDeferred).toHaveBeenCalledWith({
      estimatedUnits: 1,
      reason: "insufficient_dynamic_budget",
      retryAfter: new Date("2026-07-31T13:00:00.000Z"),
      payload: {
        source: "websub_notification_worker",
        unknownCount: 1,
      },
    });
    expect(deps.fetchVideos).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("marks notifications failed when videos.list fails", async () => {
    const unknownNotification = makeNotification({ id: "unknown-1" });
    const deps = createDeps({
      claim: claimOnce([unknownNotification]),
      fetchVideos: vi.fn(async () => {
        throw new Error("YouTube API quota exceeded");
      }),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.failed).toBe(1);
    expect(deps.complete).toHaveBeenCalledWith({
      id: "unknown-1",
      status: "failed",
      errorMessage: "YouTube API quota exceeded",
    });
    expect(deps.registerDiscoveryCandidate).not.toHaveBeenCalled();
  });

  it("processes unknown videos when videos.list succeeds", async () => {
    const unknownNotification = makeNotification({ id: "unknown-1" });
    const deps = createDeps({
      claim: claimOnce([unknownNotification]),
      fetchVideos: vi.fn(async () => [makeVideoItem(VIDEO_ID)]),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.processed).toBe(1);
    expect(deps.fetchVideos).toHaveBeenCalledWith([VIDEO_ID]);
    expect(deps.registerDiscoveryCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "websub",
        sourceKey: `websub:${CHANNEL_ID}:${VIDEO_ID}`,
        registrationPath: "websub_notification",
      }),
    );
    expect(deps.complete).toHaveBeenCalledWith({
      id: "unknown-1",
      status: "processed",
      quotaUnitsUsed: 1,
    });
  });

  it("marks duplicate discovery registrations without failing", async () => {
    const unknownNotification = makeNotification({ id: "unknown-1" });
    const deps = createDeps({
      claim: claimOnce([unknownNotification]),
      registerDiscoveryCandidate: vi.fn(
        async (): Promise<RegisterDiscoveryCandidateResult> => ({
          videoInserted: true,
          discoveryInserted: false,
          scheduleCreated: false,
        }),
      ),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.duplicate).toBe(1);
    expect(deps.complete).toHaveBeenCalledWith({
      id: "unknown-1",
      status: "duplicate",
      quotaUnitsUsed: 1,
    });
  });

  it("marks notifications failed when registerDiscoveryCandidate throws", async () => {
    const unknownNotification = makeNotification({ id: "unknown-1" });
    const deps = createDeps({
      claim: claimOnce([unknownNotification]),
      registerDiscoveryCandidate: vi.fn(async () => {
        throw new Error("discovery write failed");
      }),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(result.failed).toBe(1);
    expect(deps.complete).toHaveBeenCalledWith({
      id: "unknown-1",
      status: "failed",
      quotaUnitsUsed: 1,
      errorMessage: "discovery write failed",
    });
  });

  it("processes multiple batches until the queue is empty", async () => {
    const batchOne = [
      makeNotification({ id: "batch1-a", youtube_video_id: VIDEO_ID }),
      makeNotification({ id: "batch1-b", youtube_video_id: VIDEO_ID_2 }),
    ];
    const batchTwo = [
      makeNotification({ id: "batch2-a", youtube_video_id: "vid00000001" }),
    ];

    const claim = vi
      .fn()
      .mockResolvedValueOnce(batchOne)
      .mockResolvedValueOnce(batchTwo)
      .mockResolvedValueOnce([]);

    const deps = createDeps({
      claim,
      fetchVideos: vi.fn(async (videoIds: string[]) =>
        videoIds.map((videoId) => makeVideoItem(videoId)),
      ),
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(claim).toHaveBeenCalledTimes(3);
    expect(result.batchesProcessed).toBe(2);
    expect(result.claimed).toBe(3);
    expect(result.processed).toBe(3);
  });

  it("stops after max batches per run even when more work remains", async () => {
    const batch = [makeNotification({ id: "pending-1" })];
    const claim = vi.fn(async () => batch);
    const deps = createDeps({
      claim,
      config: {
        workerBatchSize: 1,
        workerMaxBatchesPerRun: 2,
        workerProcessingLeaseSeconds: 600,
      },
    });

    const result = await runWebsubNotificationWorker(deps);

    expect(claim).toHaveBeenCalledTimes(2);
    expect(result.batchesProcessed).toBe(2);
  });
});
