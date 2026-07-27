import { describe, expect, it, vi, beforeEach } from "vitest";

import { analyzeBuzzSnapshotDistribution } from "@/lib/ranking/buzzMeasuredDiagnostics";
import type { VideoSnapshotRow } from "@/types/database";

vi.mock("@/lib/snapshots/repository", () => ({
  fetchSnapshotsForVideos: vi.fn(),
}));

import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";

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
    subscriber_count: 1000,
    captured_at: capturedAt,
  };
}

describe("analyzeBuzzSnapshotDistribution", () => {
  beforeEach(() => {
    vi.mocked(fetchSnapshotsForVideos).mockReset();
  });

  it("counts snapshot buckets and measured eligibility", async () => {
    vi.mocked(fetchSnapshotsForVideos).mockResolvedValue(
      new Map([
        ["v0", []],
        ["v1", [makeSnapshot("v1", "2026-07-26T10:00:00.000Z", 100)]],
        [
          "v2",
          [
            makeSnapshot("v2", "2026-07-24T10:00:00.000Z", 100),
            makeSnapshot("v2", "2026-07-26T10:00:00.000Z", 200),
          ],
        ],
      ]),
    );

    const result = await analyzeBuzzSnapshotDistribution({
      videoIds: ["v0", "v1", "v2"],
      period: "24h",
      publishedAtByVideoId: new Map([
        ["v0", "2026-07-26T00:00:00.000Z"],
        ["v1", "2026-07-26T00:00:00.000Z"],
        ["v2", "2026-07-25T00:00:00.000Z"],
      ]),
    });

    expect(result.snapshotZero).toBe(1);
    expect(result.snapshotOne).toBe(1);
    expect(result.snapshotTwoOrMore).toBe(1);
    expect(result.measuredCount + result.estimatedCount).toBe(3);
  });
});
