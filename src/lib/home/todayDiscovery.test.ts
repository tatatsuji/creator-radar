import { describe, expect, it } from "vitest";

import { buildTodayDiscoveryFromVideos } from "@/lib/home/todayDiscovery";
import type { Video } from "@/types";

function buildVideo(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    title: `動画 ${id}`,
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: "2026-07-29T10:00:00.000Z",
    channel: {
      id: "channel-1",
      name: "テストチャンネル",
      subscriberCount: 10_000,
      thumbnailUrl: "https://example.com/channel.jpg",
    },
    viewCount: 50_000,
    durationSeconds: 600,
    contentKind: "regular",
    metrics: {
      period: "24h",
      viewDelta: 5_000,
      viewVelocity: 208,
      viewsPerSubscriber: 5,
      rankingScore: 72,
      metricsSource: "measured",
    },
    ...overrides,
  };
}

describe("buildTodayDiscoveryFromVideos", () => {
  it("builds cross-ranking picks including Shorts", () => {
    const payload = buildTodayDiscoveryFromVideos({
      buzz: [
        buildVideo("buzz-1"),
        buildVideo("short-1", { contentKind: "short", durationSeconds: 45 }),
      ],
      earlyRise: [buildVideo("rise-1")],
      launchSpeed: [buildVideo("launch-1")],
      potential: [buildVideo("potential-1")],
      dataFreshnessAt: "2026-07-29T11:00:00.000Z",
    });

    expect(payload.items.length).toBeGreaterThanOrEqual(5);
    expect(payload.items.some((item) => item.ranking === "buzz")).toBe(true);
    expect(payload.items.some((item) => item.ranking === "early_rise")).toBe(true);
    expect(payload.items.some((item) => item.ranking === "shorts")).toBe(true);
    expect(payload.summary).toContain("今日");
  });
});
