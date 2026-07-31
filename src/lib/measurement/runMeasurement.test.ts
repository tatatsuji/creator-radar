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

const availabilityMocks = {
  fetchAvailabilityStates: vi.fn().mockResolvedValue(new Map()),
  persistAvailabilityActive: vi.fn().mockResolvedValue(undefined),
  persistAvailabilityMissing: vi.fn().mockResolvedValue(undefined),
  stopMeasurementForUnavailable: vi.fn().mockResolvedValue(undefined),
  markVideoItemMissing: vi.fn().mockResolvedValue(undefined),
};

describe("runMeasurement", () => {
  it("stores snapshots and updates schedules on success", async () => {
    const insertSnapshot = vi.fn().mockResolvedValue("inserted");
    const updateLastObservedAt = vi.fn().mockResolvedValue(undefined);
    const markSuccess = vi.fn().mockResolvedValue(undefined);
    const releaseLock = vi.fn().mockResolvedValue(undefined);
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runMeasurement({
      getDueVideos: vi.fn().mockResolvedValue([makeSchedule("video-1")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "video-1", lockToken: "lock-1" }],
        skipped: [],
      }),
      releaseLock,
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          {
            videoId: "video-1",
            viewCount: 100,
            likeCount: 10,
            commentCount: 2,
          },
        ],
        missingVideoIds: [],
        quotaUsed: 1,
      }),
      fetchChannelIdsForVideos: vi
        .fn()
        .mockResolvedValue(new Map([["video-1", "channel-1"]])),
      fetchChannelSubscriberCounts: vi.fn().mockResolvedValue({
        subscriberCounts: new Map([["channel-1", 1000]]),
        quotaUsed: 1,
      }),
      insertSnapshot,
      fillSubscriberCountIfNull: vi.fn().mockResolvedValue(false),
      updateLastObservedAt,
      markSuccess,
      markFailure: vi.fn(),
      incrementFailure: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      createRun: vi.fn().mockResolvedValue("run-1"),
      finishRun,
      ...availabilityMocks,
    });

    expect(result.videosSucceeded).toBe(1);
    expect(result.snapshotsInserted).toBe(1);
    expect(insertSnapshot).toHaveBeenCalledTimes(1);
    expect(updateLastObservedAt).toHaveBeenCalledTimes(1);
    expect(markSuccess).toHaveBeenCalledWith(
      "video-1",
      "hot",
      expect.any(Date),
    );
    expect(finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        channelsTotal: 0,
        videosSuccess: 1,
      }),
    );
  });

  it("handles video_item_missing without updating last_observed_at", async () => {
    const updateLastObservedAt = vi.fn();
    const markVideoItemMissing = vi.fn().mockResolvedValue(undefined);
    const markFailure = vi.fn().mockResolvedValue(undefined);

    const result = await runMeasurement({
      getDueVideos: vi.fn().mockResolvedValue([makeSchedule("missing-video")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "missing-video", lockToken: "lock-1" }],
        skipped: [],
      }),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [],
        missingVideoIds: ["missing-video"],
        quotaUsed: 1,
      }),
      fetchChannelIdsForVideos: vi.fn().mockResolvedValue(new Map()),
      fetchChannelSubscriberCounts: vi.fn().mockResolvedValue({
        subscriberCounts: new Map(),
        quotaUsed: 0,
      }),
      insertSnapshot: vi.fn(),
      fillSubscriberCountIfNull: vi.fn().mockResolvedValue(false),
      updateLastObservedAt,
      markSuccess: vi.fn(),
      markFailure,
      incrementFailure: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      createRun: vi.fn().mockResolvedValue("run-2"),
      finishRun: vi.fn().mockResolvedValue(undefined),
      ...availabilityMocks,
      markVideoItemMissing,
    });

    expect(result.notFound).toBe(1);
    expect(result.videosFailed).toBe(1);
    expect(updateLastObservedAt).not.toHaveBeenCalled();
    expect(markVideoItemMissing).toHaveBeenCalledWith(
      "missing-video",
      "hot",
      expect.any(Date),
    );
    expect(markFailure).not.toHaveBeenCalled();
  });

  it("prevents duplicate snapshots within the same run", async () => {
    const insertSnapshot = vi
      .fn()
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("skipped");

    await runMeasurement({
      getDueVideos: vi
        .fn()
        .mockResolvedValue([
          makeSchedule("dup-video"),
          { ...makeSchedule("dup-video"), measurement_status: "active" },
        ]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [
          { videoId: "dup-video", lockToken: "lock-1" },
          { videoId: "dup-video", lockToken: "lock-2" },
        ],
        skipped: [],
      }),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          {
            videoId: "dup-video",
            viewCount: 10,
            likeCount: 1,
            commentCount: 0,
          },
        ],
        missingVideoIds: [],
        quotaUsed: 1,
      }),
      fetchChannelIdsForVideos: vi
        .fn()
        .mockResolvedValue(new Map([["dup-video", "channel-dup"]])),
      fetchChannelSubscriberCounts: vi.fn().mockResolvedValue({
        subscriberCounts: new Map(),
        quotaUsed: 0,
      }),
      insertSnapshot,
      fillSubscriberCountIfNull: vi.fn().mockResolvedValue(false),
      updateLastObservedAt: vi.fn().mockResolvedValue(undefined),
      markSuccess: vi.fn().mockResolvedValue(undefined),
      markFailure: vi.fn(),
      incrementFailure: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      createRun: vi.fn().mockResolvedValue("run-3"),
      finishRun: vi.fn().mockResolvedValue(undefined),
      ...availabilityMocks,
    });

    expect(insertSnapshot).toHaveBeenCalledTimes(1);
  });
});
