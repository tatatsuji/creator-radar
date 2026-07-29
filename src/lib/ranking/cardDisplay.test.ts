import { describe, expect, it } from "vitest";

import { getCardTrendInsight } from "@/lib/ranking/cardDisplay";
import type { Video } from "@/types";

const baseVideo: Video = {
  id: "abc",
  title: "Test",
  thumbnailUrl: "https://example.com/t.jpg",
  publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
  channel: {
    id: "ch1",
    name: "Channel",
    subscriberCount: 1000,
  },
  viewCount: 5000,
  metrics: {
    period: "24h",
    viewDelta: 1200,
    viewVelocity: 400,
    viewsPerSubscriber: 1.2,
    rankingScore: 72,
    metricsSource: "measured",
  },
  contentKind: "regular",
};

describe("getCardTrendInsight", () => {
  it("includes ranking prefix and measured delta", () => {
    const insight = getCardTrendInsight(baseVideo, "buzz", "24h");
    expect(insight).toContain("話題化");
    expect(insight).toContain("実測");
  });

  it("uses rankReason when rankingDisplay is present", () => {
    const video: Video = {
      ...baseVideo,
      rankingDisplay: {
        scoreName: "バズスコア",
        scoreValue: 80,
        rankReason: "24h +1.2万（実測）",
        heroLabel: "24h",
        heroValue: "+1.2万",
      },
    };
    expect(getCardTrendInsight(video, "early_rise", "24h")).toContain("加速");
    expect(getCardTrendInsight(video, "early_rise", "24h")).toContain("24h +1.2万");
  });
});
