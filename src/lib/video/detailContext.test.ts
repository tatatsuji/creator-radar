import { describe, expect, it } from "vitest";

import {
  getRankingAwarePageDescription,
  getVideoDetailRankingContext,
} from "@/lib/video/detailContext";
import type { Video } from "@/types";

function buildVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: "video-1",
    title: "テスト動画",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: "2026-07-25T00:00:00.000Z",
    channel: {
      id: "channel-1",
      name: "テストチャンネル",
      subscriberCount: 10_000,
      thumbnailUrl: "https://example.com/channel.jpg",
    },
    viewCount: 50_000,
    durationSeconds: 600,
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

describe("video detail context", () => {
  it("answers why the video appears in early_rise ranking", () => {
    const context = getVideoDetailRankingContext(buildVideo(), "early_rise", "24h");

    expect(context.rankingLabel).toBe("伸び始め");
    expect(context.userQuestion).toBe("なぜ「伸び始め」に入った？");
    expect(context.whyHere).toContain("加速");
    expect(context.scoreLabel).toBe("加速スコア");
    expect(context.revisitHint).toContain("明日");
  });

  it("uses rankReason when rankingDisplay is present", () => {
    const context = getVideoDetailRankingContext(
      buildVideo({
        rankingDisplay: {
          scoreName: "加速スコア",
          scoreValue: 88,
          heroLabel: "24時間の伸び",
          heroValue: "+1.2万",
          rankReason: "24h +1.2万回で加速",
        },
      }),
      "early_rise",
      "24h",
    );

    expect(context.whyHere).toContain("24h +1.2万回で加速");
    expect(context.takeaway).toContain("24h +1.2万回で加速");
    expect(context.scoreValue).toBe("88");
  });

  it("builds shareable metadata with ranking context", () => {
    const description = getRankingAwarePageDescription(buildVideo(), "buzz");

    expect(description).toContain("テストチャンネル");
    expect(description).toContain("話題化");
    expect(description).toContain("バズスコア");
  });
});
