import { describe, expect, it } from "vitest";

import { getActionableTakeaways } from "@/lib/video/actionableInsights";
import type { Video } from "@/types";

function buildVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: "video-1",
    title: "【衝撃】100万回再生の秘密？初心者でも真似できる方法",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: "2026-07-26T12:00:00.000Z",
    channel: {
      id: "channel-1",
      name: "テストチャンネル",
      subscriberCount: 10_000,
      thumbnailUrl: "https://example.com/channel.jpg",
    },
    viewCount: 50_000,
    durationSeconds: 480,
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

describe("getActionableTakeaways", () => {
  it("extracts title, timing, format, and reach patterns", () => {
    const takeaways = getActionableTakeaways(buildVideo());

    expect(takeaways.map((item) => item.category)).toEqual([
      "title",
      "timing",
      "format",
      "reach",
    ]);
    expect(takeaways[0]?.observation).toContain("数字あり");
    expect(takeaways[0]?.observation).toContain("括弧で強調");
    expect(takeaways[1]?.observation).toContain("JST");
    expect(takeaways[2]?.observation).toContain("3〜10分");
    expect(takeaways[3]?.tip).toContain("アルゴリ");
  });

  it("handles Shorts with format-specific tips", () => {
    const takeaways = getActionableTakeaways(
      buildVideo({
        contentKind: "short",
        durationSeconds: 45,
        title: "秒で分かるTips",
      }),
    );

    const format = takeaways.find((item) => item.category === "format");
    expect(format?.observation).toContain("Shorts");
    expect(format?.tip).toContain("Shorts");
  });
});
