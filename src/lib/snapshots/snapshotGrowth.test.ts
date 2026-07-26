import { describe, expect, it } from "vitest";

import {
  computeLatestSnapshotGrowth,
  computeSnapshotGrowthSeries,
  computeSnapshotPairGrowth,
} from "@/lib/snapshots/snapshotGrowth";
import type { VideoSnapshotRow } from "@/types/database";

function snapshot(
  videoId: string,
  capturedAt: string,
  viewCount: number,
): VideoSnapshotRow {
  return {
    id: `${videoId}-${capturedAt}`,
    video_id: videoId,
    view_count: viewCount,
    like_count: 10,
    comment_count: 1,
    subscriber_count: 1000,
    captured_at: capturedAt,
  };
}

describe("snapshot growth", () => {
  it("computes views per hour from captured_at delta", () => {
    const segment = computeSnapshotPairGrowth(
      snapshot("v1", "2026-07-26T10:00:00.000Z", 100),
      snapshot("v1", "2026-07-26T12:00:00.000Z", 300),
    );

    expect(segment.status).toBe("measured");
    expect(segment.viewsGained).toBe(200);
    expect(segment.hoursElapsed).toBe(2);
    expect(segment.viewsPerHour).toBe(100);
  });

  it("rejects non-positive elapsed time", () => {
    const segment = computeSnapshotPairGrowth(
      snapshot("v1", "2026-07-26T12:00:00.000Z", 100),
      snapshot("v1", "2026-07-26T12:00:00.000Z", 120),
    );

    expect(segment.status).toBe("invalid");
    expect(segment.viewsPerHour).toBeNull();
  });

  it("rejects negative view gains", () => {
    const segment = computeSnapshotPairGrowth(
      snapshot("v1", "2026-07-26T10:00:00.000Z", 500),
      snapshot("v1", "2026-07-26T11:00:00.000Z", 400),
    );

    expect(segment.status).toBe("invalid");
    expect(segment.invalidReason).toBe("viewsGained < 0");
  });

  it("computes velocity change and acceleration from prior segment", () => {
    const snapshots = [
      snapshot("v1", "2026-07-26T08:00:00.000Z", 100),
      snapshot("v1", "2026-07-26T09:00:00.000Z", 150),
      snapshot("v1", "2026-07-26T10:00:00.000Z", 350),
    ];

    const latest = computeLatestSnapshotGrowth(snapshots);

    expect(latest?.status).toBe("measured");
    expect(latest?.previousViewsPerHour).toBe(50);
    expect(latest?.viewsPerHour).toBe(200);
    expect(latest?.velocityChange).toBe(150);
    expect(latest?.acceleration).toBe(150);
  });

  it("builds a growth series for multiple snapshots", () => {
    const segments = computeSnapshotGrowthSeries([
      snapshot("v1", "2026-07-26T08:00:00.000Z", 100),
      snapshot("v1", "2026-07-26T09:00:00.000Z", 160),
      snapshot("v1", "2026-07-26T10:00:00.000Z", 260),
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0].viewsPerHour).toBe(60);
    expect(segments[1].viewsPerHour).toBe(100);
  });
});
