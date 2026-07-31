import { describe, expect, it, vi } from "vitest";

import { YouTubeBatchRequestError } from "@/lib/youtube/apiErrors";
import { runMeasurement } from "@/lib/measurement/runMeasurement";
import type { MeasurementScheduleRow } from "@/types/database";
import type { VideoAvailabilityState } from "@/lib/video/videoAvailability";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

function makeSchedule(
  videoId: string,
  overrides: Partial<MeasurementScheduleRow> = {},
): MeasurementScheduleRow {
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
    ...overrides,
  };
}

function activeState(): VideoAvailabilityState {
  return {
    availabilityStatus: "active",
    unavailableCount: 0,
    firstUnavailableAt: null,
    lastUnavailableAt: null,
  };
}

function availabilityDeps(
  states: Map<string, VideoAvailabilityState>,
  overrides: Partial<Parameters<typeof runMeasurement>[0]> = {},
) {
  return {
    fetchAvailabilityStates: vi.fn().mockResolvedValue(new Map(states)),
    persistAvailabilityActive: vi.fn().mockImplementation(async (videoId: string) => {
      states.set(videoId, activeState());
    }),
    persistAvailabilityMissing: vi
      .fn()
      .mockImplementation(async (videoId: string, next: VideoAvailabilityState) => {
        states.set(videoId, next);
      }),
    stopMeasurementForUnavailable: vi.fn().mockResolvedValue(undefined),
    markVideoItemMissing: vi.fn().mockResolvedValue(undefined),
    fetchChannelIdsForVideos: vi.fn().mockResolvedValue(new Map()),
    fetchChannelSubscriberCounts: vi.fn().mockResolvedValue({
      subscriberCounts: new Map(),
      quotaUsed: 0,
    }),
    fillSubscriberCountIfNull: vi.fn().mockResolvedValue(false),
    incrementFailure: vi.fn(),
    findRunningRun: vi.fn().mockResolvedValue(null),
    createRun: vi.fn().mockResolvedValue("run-availability"),
    finishRun: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn().mockResolvedValue(undefined),
    markFailure: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("runMeasurement availability", () => {
  it("keeps all returned videos active and continues measurement", async () => {
    const states = new Map([
      ["video-a", activeState()],
      ["video-b", activeState()],
    ]);

    const markSuccess = vi.fn().mockResolvedValue({
      previousTier: "hot",
      nextTier: "normal",
      reason: "default_normal",
      tierChanged: false,
    });
    const insertSnapshot = vi.fn().mockResolvedValue("inserted");

    const result = await runMeasurement({
      ...availabilityDeps(states),
      getDueVideos: vi
        .fn()
        .mockResolvedValue([makeSchedule("video-a"), makeSchedule("video-b")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [
          { videoId: "video-a", lockToken: "lock-a" },
          { videoId: "video-b", lockToken: "lock-b" },
        ],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          { videoId: "video-a", viewCount: 1, likeCount: 0, commentCount: 0 },
          { videoId: "video-b", viewCount: 2, likeCount: 1, commentCount: 0 },
        ],
        missingVideoIds: [],
        quotaUsed: 1,
      }),
      insertSnapshot,
      updateLastObservedAt: vi.fn().mockResolvedValue(undefined),
      markSuccess,
    });

    expect(result.videosSucceeded).toBe(2);
    expect(result.availability.missingCount).toBe(0);
    expect(markSuccess).toHaveBeenCalledTimes(2);
    expect(states.get("video-a")?.availabilityStatus).toBe("active");
    expect(states.get("video-b")?.availabilityStatus).toBe("active");
  });

  it("marks only missing IDs as unavailable_pending while returned IDs stay active", async () => {
    const states = new Map([
      ["video-a", activeState()],
      ["video-b", activeState()],
    ]);
    const markVideoItemMissing = vi.fn().mockResolvedValue(undefined);

    await runMeasurement({
      ...availabilityDeps(states, { markVideoItemMissing }),
      getDueVideos: vi
        .fn()
        .mockResolvedValue([makeSchedule("video-a"), makeSchedule("video-b")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [
          { videoId: "video-a", lockToken: "lock-a" },
          { videoId: "video-b", lockToken: "lock-b" },
        ],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          { videoId: "video-a", viewCount: 10, likeCount: 1, commentCount: 0 },
        ],
        missingVideoIds: ["video-b"],
        quotaUsed: 1,
      }),
      insertSnapshot: vi.fn().mockResolvedValue("inserted"),
      updateLastObservedAt: vi.fn().mockResolvedValue(undefined),
      markSuccess: vi.fn().mockResolvedValue({
        previousTier: "hot",
        nextTier: "normal",
        reason: "default_normal",
        tierChanged: false,
      }),
    });

    expect(states.get("video-a")?.availabilityStatus).toBe("active");
    expect(states.get("video-b")?.availabilityStatus).toBe("unavailable_pending");
    expect(states.get("video-b")?.unavailableCount).toBe(1);
    expect(markVideoItemMissing).toHaveBeenCalledWith(
      "video-b",
      "hot",
      expect.any(Date),
    );
  });

  it("does not confirm deleted_or_private after one miss", async () => {
    const states = new Map([["missing", activeState()]]);
    const stopMeasurementForUnavailable = vi.fn().mockResolvedValue(undefined);

    await runMeasurement({
      ...availabilityDeps(states, { stopMeasurementForUnavailable }),
      getDueVideos: vi.fn().mockResolvedValue([makeSchedule("missing")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "missing", lockToken: "lock-1" }],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [],
        missingVideoIds: ["missing"],
        quotaUsed: 1,
      }),
      insertSnapshot: vi.fn(),
      updateLastObservedAt: vi.fn(),
      markSuccess: vi.fn(),
    });

    expect(states.get("missing")?.availabilityStatus).toBe("unavailable_pending");
    expect(stopMeasurementForUnavailable).not.toHaveBeenCalled();
  });

  it("does not stop measurement after three quick misses within six hours", async () => {
    const recentFirstUnavailable = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const states = new Map([
      [
        "missing",
        {
          availabilityStatus: "unavailable_pending" as const,
          unavailableCount: 2,
          firstUnavailableAt: recentFirstUnavailable,
          lastUnavailableAt: recentFirstUnavailable,
        },
      ],
    ]);
    const stopMeasurementForUnavailable = vi.fn().mockResolvedValue(undefined);
    const markFailure = vi.fn().mockResolvedValue(undefined);

    await runMeasurement({
      ...availabilityDeps(states, { stopMeasurementForUnavailable, markFailure }),
      getDueVideos: vi.fn().mockResolvedValue([
        makeSchedule("missing", { failure_count: 0, measurement_status: "pending" }),
      ]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "missing", lockToken: "lock-1" }],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [],
        missingVideoIds: ["missing"],
        quotaUsed: 1,
      }),
      insertSnapshot: vi.fn(),
      updateLastObservedAt: vi.fn(),
      markSuccess: vi.fn(),
    });

    expect(states.get("missing")?.availabilityStatus).toBe("unavailable_pending");
    expect(states.get("missing")?.unavailableCount).toBe(3);
    expect(stopMeasurementForUnavailable).not.toHaveBeenCalled();
    expect(markFailure).not.toHaveBeenCalled();
  });

  it("keeps unavailable_pending videos scheduled for recheck via markVideoItemMissing", async () => {
    const states = new Map([["missing", activeState()]]);
    const markVideoItemMissing = vi.fn().mockResolvedValue(undefined);

    await runMeasurement({
      ...availabilityDeps(states, { markVideoItemMissing }),
      getDueVideos: vi.fn().mockResolvedValue([makeSchedule("missing")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "missing", lockToken: "lock-1" }],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [],
        missingVideoIds: ["missing"],
        quotaUsed: 1,
      }),
      insertSnapshot: vi.fn(),
      updateLastObservedAt: vi.fn(),
      markSuccess: vi.fn(),
    });

    expect(markVideoItemMissing).toHaveBeenCalledWith(
      "missing",
      "hot",
      expect.any(Date),
    );
    expect(states.get("missing")?.availabilityStatus).toBe("unavailable_pending");
  });

  it("confirms deleted_or_private and stops measurement only after threshold and elapsed time", async () => {
    const states = new Map([
      [
        "missing",
        {
          availabilityStatus: "unavailable_pending" as const,
          unavailableCount: 2,
          firstUnavailableAt: "2026-07-24T00:00:00.000Z",
          lastUnavailableAt: "2026-07-24T06:00:00.000Z",
        },
      ],
    ]);
    const stopMeasurementForUnavailable = vi.fn().mockResolvedValue(undefined);
    const markVideoItemMissing = vi.fn().mockResolvedValue(undefined);

    await runMeasurement({
      ...availabilityDeps(states, {
        stopMeasurementForUnavailable,
        markVideoItemMissing,
      }),
      getDueVideos: vi.fn().mockResolvedValue([makeSchedule("missing")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "missing", lockToken: "lock-1" }],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [],
        missingVideoIds: ["missing"],
        quotaUsed: 1,
      }),
      insertSnapshot: vi.fn(),
      updateLastObservedAt: vi.fn(),
      markSuccess: vi.fn(),
    });

    expect(states.get("missing")?.availabilityStatus).toBe("deleted_or_private");
    expect(stopMeasurementForUnavailable).toHaveBeenCalledTimes(1);
    expect(stopMeasurementForUnavailable).toHaveBeenCalledWith("missing");
    expect(markVideoItemMissing).toHaveBeenCalledTimes(1);
  });

  it("recovers unavailable_pending videos to active when fetched again", async () => {
    const states = new Map([
      [
        "video-a",
        {
          availabilityStatus: "unavailable_pending" as const,
          unavailableCount: 2,
          firstUnavailableAt: "2026-07-24T00:00:00.000Z",
          lastUnavailableAt: "2026-07-24T01:00:00.000Z",
        },
      ],
    ]);

    const result = await runMeasurement({
      ...availabilityDeps(states),
      getDueVideos: vi.fn().mockResolvedValue([makeSchedule("video-a")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [{ videoId: "video-a", lockToken: "lock-1" }],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          { videoId: "video-a", viewCount: 99, likeCount: 1, commentCount: 0 },
        ],
        missingVideoIds: [],
        quotaUsed: 1,
      }),
      insertSnapshot: vi.fn().mockResolvedValue("inserted"),
      updateLastObservedAt: vi.fn().mockResolvedValue(undefined),
      markSuccess: vi.fn().mockResolvedValue({
        previousTier: "hot",
        nextTier: "normal",
        reason: "default_normal",
        tierChanged: false,
      }),
    });

    expect(result.availability.recoveredToActive).toBe(1);
    expect(states.get("video-a")?.availabilityStatus).toBe("active");
    expect(states.get("video-a")?.unavailableCount).toBe(0);
  });

  it("does not increment unavailable counts when the batch API fails", async () => {
    const states = new Map([
      ["video-a", activeState()],
      ["video-b", activeState()],
    ]);
    const persistAvailabilityMissing = vi.fn().mockResolvedValue(undefined);

    const result = await runMeasurement({
      ...availabilityDeps(states, { persistAvailabilityMissing }),
      getDueVideos: vi
        .fn()
        .mockResolvedValue([makeSchedule("video-a"), makeSchedule("video-b")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [
          { videoId: "video-a", lockToken: "lock-a" },
          { videoId: "video-b", lockToken: "lock-b" },
        ],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockRejectedValue(
        new YouTubeBatchRequestError("quotaExceeded", "quotaExceeded"),
      ),
      insertSnapshot: vi.fn(),
      updateLastObservedAt: vi.fn(),
      markSuccess: vi.fn(),
    });

    expect(result.availability.apiErrorCount).toBe(2);
    expect(result.availability.missingCount).toBe(0);
    expect(persistAvailabilityMissing).not.toHaveBeenCalled();
    expect(states.get("video-a")?.unavailableCount).toBe(0);
    expect(states.get("video-b")?.unavailableCount).toBe(0);
  });

  it("does not treat quota, network, or backend errors as video misses", async () => {
    for (const kind of ["quotaExceeded", "network_error", "backendError"] as const) {
      const states = new Map([["video-a", activeState()]]);
      const persistAvailabilityMissing = vi.fn().mockResolvedValue(undefined);

      await runMeasurement({
        ...availabilityDeps(states, { persistAvailabilityMissing }),
        getDueVideos: vi.fn().mockResolvedValue([makeSchedule("video-a")]),
        acquireLocks: vi.fn().mockResolvedValue({
          locked: [{ videoId: "video-a", lockToken: "lock-1" }],
          skipped: [],
        }),
        fetchStatistics: vi
          .fn()
          .mockRejectedValue(new YouTubeBatchRequestError(kind, kind)),
        insertSnapshot: vi.fn(),
        updateLastObservedAt: vi.fn(),
        markSuccess: vi.fn(),
      });

      expect(persistAvailabilityMissing).not.toHaveBeenCalled();
    }
  });

  it("still inserts snapshots for returned IDs when another ID is missing in the batch", async () => {
    const insertSnapshot = vi.fn().mockResolvedValue("inserted");
    const states = new Map([
      ["present", activeState()],
      ["absent", activeState()],
    ]);

    await runMeasurement({
      ...availabilityDeps(states),
      getDueVideos: vi
        .fn()
        .mockResolvedValue([makeSchedule("present"), makeSchedule("absent")]),
      acquireLocks: vi.fn().mockResolvedValue({
        locked: [
          { videoId: "present", lockToken: "lock-a" },
          { videoId: "absent", lockToken: "lock-b" },
        ],
        skipped: [],
      }),
      fetchStatistics: vi.fn().mockResolvedValue({
        statistics: [
          { videoId: "present", viewCount: 5, likeCount: 1, commentCount: 0 },
        ],
        missingVideoIds: ["absent"],
        quotaUsed: 1,
      }),
      insertSnapshot,
      updateLastObservedAt: vi.fn().mockResolvedValue(undefined),
      markSuccess: vi.fn().mockResolvedValue({
        previousTier: "hot",
        nextTier: "normal",
        reason: "default_normal",
        tierChanged: false,
      }),
    });

    expect(insertSnapshot).toHaveBeenCalledTimes(1);
    expect(insertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "present" }),
    );
  });
});
