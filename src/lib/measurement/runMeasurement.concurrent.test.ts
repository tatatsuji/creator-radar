import { describe, expect, it, vi } from "vitest";

import { runMeasurement } from "@/lib/measurement/runMeasurement";
import type { MeasurementScheduleRow } from "@/types/database";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

function makeSchedule(videoId: string): MeasurementScheduleRow {
  return {
    video_id: videoId,
    measurement_tier: "hot",
    measurement_status: "pending",
    next_measurement_at: "2026-07-24T00:00:00.000Z",
    last_measured_at: null,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
  };
}

describe("runMeasurement concurrent guard", () => {
  it("rejects when another measurement run is already in progress", async () => {
    await expect(
      runMeasurement({
        getDueVideos: vi.fn(),
        acquireLocks: vi.fn(),
        releaseLock: vi.fn(),
        fetchStatistics: vi.fn(),
        fetchChannelIdsForVideos: vi.fn(),
        fetchChannelSubscriberCounts: vi.fn(),
        insertSnapshot: vi.fn(),
        fillSubscriberCountIfNull: vi.fn(),
        updateLastObservedAt: vi.fn(),
        markSuccess: vi.fn(),
        markFailure: vi.fn(),
        incrementFailure: vi.fn(),
        findRunningRun: vi.fn().mockResolvedValue({
          id: "running-run",
          status: "running",
        }),
        createRun: vi.fn(),
        finishRun: vi.fn(),
      }),
    ).rejects.toThrow("Measurement is already in progress.");
  });

  it("skips videos that could not acquire a lock", async () => {
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runMeasurement({
      getDueVideos: vi
        .fn()
        .mockResolvedValue([
          makeSchedule("video-locked"),
          makeSchedule("video-ready"),
        ]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "video-ready", lockToken: "lock-1" }],
        skipped: ["video-locked"],
      }),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          {
            videoId: "video-ready",
            viewCount: 10,
            likeCount: 1,
            commentCount: 0,
          },
        ],
        quotaUsed: 1,
      }),
      fetchChannelIdsForVideos: vi
        .fn()
        .mockResolvedValue(new Map([["video-ready", "channel-ready"]])),
      fetchChannelSubscriberCounts: vi.fn().mockResolvedValue({
        subscriberCounts: new Map(),
        quotaUsed: 0,
      }),
      insertSnapshot: vi.fn().mockResolvedValue("inserted"),
      fillSubscriberCountIfNull: vi.fn().mockResolvedValue(false),
      updateLastObservedAt: vi.fn().mockResolvedValue(undefined),
      markSuccess: vi.fn().mockResolvedValue(undefined),
      markFailure: vi.fn(),
      incrementFailure: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      createRun: vi.fn().mockResolvedValue("run-1"),
      finishRun,
    });

    expect(result.videosLocked).toBe(1);
    expect(result.videosSucceeded).toBe(1);
    expect(result.errors).toEqual([
      { videoId: "video-locked", reason: "lock_unavailable" },
    ]);
  });
});
