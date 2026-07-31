import { describe, expect, it } from "vitest";

import { VIDEO_AVAILABILITY_CONFIG } from "@/lib/video/availabilityConfig";
import {
  applyAvailabilityOnFound,
  applyAvailabilityOnMissing,
  computeMissingVideoIds,
} from "@/lib/video/videoAvailability";

describe("computeMissingVideoIds", () => {
  it("compares requested and returned IDs", () => {
    expect(
      computeMissingVideoIds(
        ["video-a", "video-b", "video-c", "video-d"],
        ["video-a", "video-c"],
      ),
    ).toEqual(["video-b", "video-d"]);
  });
});

describe("applyAvailabilityOnFound", () => {
  it("resets unavailable_pending videos to active", () => {
    const transition = applyAvailabilityOnFound(
      {
        availabilityStatus: "unavailable_pending",
        unavailableCount: 2,
        firstUnavailableAt: "2026-07-24T00:00:00.000Z",
        lastUnavailableAt: "2026-07-24T01:00:00.000Z",
      },
      "2026-07-24T02:00:00.000Z",
    );

    expect(transition.recoveredToActive).toBe(true);
    expect(transition.next.availabilityStatus).toBe("active");
    expect(transition.next.unavailableCount).toBe(0);
    expect(transition.next.firstUnavailableAt).toBeNull();
  });
});

describe("applyAvailabilityOnMissing", () => {
  const config = {
    ...VIDEO_AVAILABILITY_CONFIG,
    confirmMissingCount: 3,
    confirmMinElapsedMs: 6 * 60 * 60 * 1000,
  };

  it("moves active videos to unavailable_pending on first miss", () => {
    const transition = applyAvailabilityOnMissing(
      {
        availabilityStatus: "active",
        unavailableCount: 0,
        firstUnavailableAt: null,
        lastUnavailableAt: null,
      },
      "2026-07-24T00:00:00.000Z",
      Date.parse("2026-07-24T00:00:00.000Z"),
      config,
    );

    expect(transition.movedToPending).toBe(true);
    expect(transition.movedToDeletedOrPrivate).toBe(false);
    expect(transition.next.availabilityStatus).toBe("unavailable_pending");
    expect(transition.next.unavailableCount).toBe(1);
  });

  it("does not confirm deleted_or_private after a single miss", () => {
    const transition = applyAvailabilityOnMissing(
      {
        availabilityStatus: "unavailable_pending",
        unavailableCount: 1,
        firstUnavailableAt: "2026-07-24T00:00:00.000Z",
        lastUnavailableAt: "2026-07-24T00:00:00.000Z",
      },
      "2026-07-24T01:00:00.000Z",
      Date.parse("2026-07-24T01:00:00.000Z"),
      config,
    );

    expect(transition.next.availabilityStatus).toBe("unavailable_pending");
    expect(transition.next.unavailableCount).toBe(2);
    expect(transition.movedToDeletedOrPrivate).toBe(false);
  });

  it("does not confirm when count threshold met but elapsed time is too short", () => {
    const transition = applyAvailabilityOnMissing(
      {
        availabilityStatus: "unavailable_pending",
        unavailableCount: 2,
        firstUnavailableAt: "2026-07-24T00:00:00.000Z",
        lastUnavailableAt: "2026-07-24T02:00:00.000Z",
      },
      "2026-07-24T03:00:00.000Z",
      Date.parse("2026-07-24T03:00:00.000Z"),
      config,
    );

    expect(transition.next.availabilityStatus).toBe("unavailable_pending");
    expect(transition.next.unavailableCount).toBe(3);
    expect(transition.movedToDeletedOrPrivate).toBe(false);
  });

  it("confirms deleted_or_private after threshold and elapsed time", () => {
    const transition = applyAvailabilityOnMissing(
      {
        availabilityStatus: "unavailable_pending",
        unavailableCount: 2,
        firstUnavailableAt: "2026-07-24T00:00:00.000Z",
        lastUnavailableAt: "2026-07-24T06:00:00.000Z",
      },
      "2026-07-24T07:00:00.000Z",
      Date.parse("2026-07-24T07:00:00.000Z"),
      config,
    );

    expect(transition.movedToDeletedOrPrivate).toBe(true);
    expect(transition.next.availabilityStatus).toBe("deleted_or_private");
    expect(transition.next.unavailableCount).toBe(3);
  });

  it("leaves deleted_or_private videos unchanged", () => {
    const current = {
      availabilityStatus: "deleted_or_private" as const,
      unavailableCount: 5,
      firstUnavailableAt: "2026-07-24T00:00:00.000Z",
      lastUnavailableAt: "2026-07-24T08:00:00.000Z",
    };

    const transition = applyAvailabilityOnMissing(
      current,
      "2026-07-24T09:00:00.000Z",
      Date.parse("2026-07-24T09:00:00.000Z"),
      config,
    );

    expect(transition.next).toEqual(current);
    expect(transition.movedToDeletedOrPrivate).toBe(false);
  });
});
