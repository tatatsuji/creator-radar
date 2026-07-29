import { describe, expect, it } from "vitest";

import {
  buildSubscriberRatioRankingVideos,
  isSubscriberRatioEligible,
  scoreSubscriberRatio,
} from "@/lib/ranking/engines/subscriberRatioRanking";
import type { Video } from "@/types";

function buildVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: "video-1",
    title: "小規模チャンネルのヒット",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: "2026-07-25T00:00:00.000Z",
    channel: {
      id: "channel-1",
      name: "小さなチャンネル",
      subscriberCount: 5_000,
      thumbnailUrl: "https://example.com/channel.jpg",
    },
    viewCount: 50_000,
    durationSeconds: 600,
    metrics: {
      period: "24h",
      viewDelta: 10_000,
      viewVelocity: 400,
      viewsPerSubscriber: 10,
      rankingScore: 50,
      metricsSource: "measured",
    },
    ...overrides,
  };
}

describe("subscriberRatioRanking", () => {
  it("ranks videos by views per subscriber", async () => {
    const ranked = await buildSubscriberRatioRankingVideos(
      [
        buildVideo({
          id: "low-ratio",
          metrics: {
            period: "24h",
            viewDelta: 1_000,
            viewVelocity: 40,
            viewsPerSubscriber: 2,
            rankingScore: 20,
            metricsSource: "measured",
          },
        }),
        buildVideo({
          id: "high-ratio",
          metrics: {
            period: "24h",
            viewDelta: 10_000,
            viewVelocity: 400,
            viewsPerSubscriber: 10,
            rankingScore: 50,
            metricsSource: "measured",
          },
        }),
      ],
      "24h",
    );

    expect(ranked[0]?.id).toBe("high-ratio");
    expect(ranked[0]?.rankingDisplay?.scoreName).toBe("登録者比スコア");
    expect(ranked[0]?.rankingDisplay?.heroLabel).toBe("再生/登録者比");
  });

  it("excludes hidden subscriber counts", () => {
    expect(
      isSubscriberRatioEligible(
        buildVideo({
          channel: {
            id: "channel-1",
            name: "非公開",
            subscriberCount: 0,
            subscriberCountHidden: true,
          },
        }),
      ),
    ).toBe(false);
  });

  it("maps ratio to display score", () => {
    expect(scoreSubscriberRatio(5)).toBe(100);
    expect(scoreSubscriberRatio(0.5)).toBe(10);
  });
});
