import { describe, expect, it } from "vitest";

import {
  analyzeMixedSourceSnapshots,
  analyzeVideoVelocity,
  computeVelocitySample,
} from "@/lib/observability/velocity";
import type { VideoSnapshotRow } from "@/types/database";

function makeSnapshot(
  videoId: string,
  capturedAt: string,
  viewCount: number,
): VideoSnapshotRow {
  return {
    id: `${videoId}-${capturedAt}`,
    video_id: videoId,
    view_count: viewCount,
    like_count: null,
    comment_count: null,
    subscriber_count: null,
    captured_at: capturedAt,
  };
}

describe("velocity pure functions", () => {
  const snapshots = [
    makeSnapshot("video-1", "2026-07-26T00:00:00.000Z", 100),
    makeSnapshot("video-1", "2026-07-26T01:00:00.000Z", 160),
    makeSnapshot("video-1", "2026-07-26T03:00:00.000Z", 280),
    makeSnapshot("video-1", "2026-07-26T06:00:00.000Z", 520),
  ];

  it("computes measured 1-hour velocity when exact boundary exists", () => {
    const sample = computeVelocitySample(
      snapshots,
      1,
      Date.parse("2026-07-26T01:00:00.000Z"),
    );

    expect(sample.quality).toBe("measured");
    expect(sample.viewDelta).toBe(60);
    expect(sample.viewsPerHour).toBe(60);
  });

  it("marks estimated velocity when exact window start is missing", () => {
    const sample = computeVelocitySample(
      snapshots,
      3,
      Date.parse("2026-07-26T01:30:00.000Z"),
    );

    expect(sample.quality).toBe("estimated");
    expect(sample.viewsPerHour).toBeGreaterThan(0);
    expect(sample.reason).toBe("nearest_snapshot_used");
  });

  it("returns unavailable when only one snapshot exists", () => {
    const sample = computeVelocitySample(
      [snapshots[0]],
      24,
      Date.parse("2026-07-26T01:00:00.000Z"),
    );

    expect(sample.quality).toBe("unavailable");
    expect(sample.reason).toBe("insufficient_snapshots");
  });

  it("analyzes all standard windows", () => {
    const analysis = analyzeVideoVelocity(
      "video-1",
      snapshots,
      Date.parse("2026-07-26T06:00:00.000Z"),
    );

    expect(analysis.samples).toHaveLength(4);
    expect(analysis.samples.map((sample) => sample.windowHours)).toEqual([
      1, 3, 6, 24,
    ]);
  });

  it("detects hourly bucket collisions from mixed sources", () => {
    const mixed = [
      makeSnapshot("video-1", "2026-07-26T01:10:00.000Z", 100),
      makeSnapshot("video-1", "2026-07-26T01:40:00.000Z", 110),
    ];

    expect(analyzeMixedSourceSnapshots(mixed).duplicateHourBuckets).toBe(1);
  });
});
