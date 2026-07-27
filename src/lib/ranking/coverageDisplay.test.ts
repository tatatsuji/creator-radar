import { describe, expect, it } from "vitest";

import {
  formatMetricsCoverageLine,
} from "@/lib/ranking/coverageDisplay";
import { resolveLatestSnapshotCapturedAt } from "@/lib/ranking/snapshotMetrics";
import type { VideoSnapshotRow } from "@/types/database";

describe("coverage display", () => {
  it("formats measured and estimated counts", () => {
    expect(formatMetricsCoverageLine({ measured: 3, estimated: 12, total: 15 })).toBe(
      "実測 3件 · 推定 12件 · カバレッジ 20%",
    );
  });
});

describe("resolveLatestSnapshotCapturedAt", () => {
  it("returns the newest captured_at across videos", () => {
    const snapshots = new Map<string, VideoSnapshotRow[]>([
      [
        "video-1",
        [
          {
            id: "1",
            video_id: "video-1",
            view_count: 100,
            like_count: null,
            comment_count: null,
            subscriber_count: null,
            captured_at: "2026-07-26T01:00:00.000Z",
          },
        ],
      ],
      [
        "video-2",
        [
          {
            id: "2",
            video_id: "video-2",
            view_count: 200,
            like_count: null,
            comment_count: null,
            subscriber_count: null,
            captured_at: "2026-07-26T06:00:00.000Z",
          },
        ],
      ],
    ]);

    expect(resolveLatestSnapshotCapturedAt(snapshots)).toBe(
      "2026-07-26T06:00:00.000Z",
    );
  });
});
