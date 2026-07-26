import { describe, expect, it } from "vitest";

import {
  getAnalysisPageDescription,
  getVideoAnalysisInsight,
} from "@/lib/video/analysisDisplay";
import { RANKING_REFERENCE_LABEL } from "@/lib/home/copy";
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

describe("video analysis display", () => {
  it("describes measured growth with ranking reference", () => {
    const insight = getVideoAnalysisInsight(buildVideo(), "24h");

    expect(insight.headline).toContain("実測");
    expect(insight.highlights[0]).toContain("24時間の伸び");
    expect(insight.rankingReference.label).toBe(RANKING_REFERENCE_LABEL);
    expect(insight.rankingReference.value).toBe("72 / 100");
    expect(insight.dataSourceNote).toContain("実測");
  });

  it("uses estimated messaging when metrics are estimated", () => {
    const insight = getVideoAnalysisInsight(
      buildVideo({
        metrics: {
          period: "24h",
          viewDelta: 0,
          viewVelocity: 120,
          viewsPerSubscriber: 0.2,
          rankingScore: 55,
          metricsSource: "estimated",
        },
      }),
      "24h",
    );

    expect(insight.headline).toContain("推定");
    expect(insight.summary).toContain("実測グラフ");
    expect(insight.dataSourceNote).toContain("推定");
  });

  it("builds metadata description with ranking reference label", () => {
    const description = getAnalysisPageDescription(buildVideo());

    expect(description).toContain(RANKING_REFERENCE_LABEL);
    expect(description).toContain("72 / 100");
  });
});
