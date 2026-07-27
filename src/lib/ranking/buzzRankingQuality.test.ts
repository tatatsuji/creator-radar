import { describe, expect, it } from "vitest";

import {
  applyBuzzChannelCap,
  auditBuzzTop100,
  compareBuzzRankedVideos,
  finalizeBuzzRankingList,
  passesBuzzQualityGate,
} from "@/lib/ranking/buzzRankingQuality";
import type { RankingPeriod, Video } from "@/types";

function makeVideo(input: {
  id: string;
  channelId: string;
  score: number;
  velocity: number;
  metricsSource?: "measured" | "estimated";
  publishedAt?: string;
  categoryId?: string;
  contentKind?: Video["contentKind"];
}): Video {
  return {
    id: input.id,
    title: `Video ${input.id}`,
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: input.publishedAt ?? new Date().toISOString(),
    categoryId: input.categoryId,
    contentKind: input.contentKind,
    channel: {
      id: input.channelId,
      name: `Channel ${input.channelId}`,
      subscriberCount: 1000,
    },
    viewCount: 1000,
    metrics: {
      period: "24h" as RankingPeriod,
      viewDelta: 100,
      viewVelocity: input.velocity,
      viewsPerSubscriber: 1,
      rankingScore: input.score,
      metricsSource: input.metricsSource ?? "estimated",
    },
  };
}

describe("buzzRankingQuality", () => {
  it("excludes score 0 and non-positive velocity", () => {
    expect(
      passesBuzzQualityGate(makeVideo({ id: "a", channelId: "c1", score: 0, velocity: 10 }), "24h"),
    ).toBe(false);
    expect(
      passesBuzzQualityGate(makeVideo({ id: "b", channelId: "c1", score: 10, velocity: 0 }), "24h"),
    ).toBe(false);
    expect(
      passesBuzzQualityGate(makeVideo({ id: "c", channelId: "c1", score: 10, velocity: 5 }), "24h"),
    ).toBe(true);
  });

  it("prioritizes measured videos over estimated with equal score", () => {
    const measured = makeVideo({
      id: "m",
      channelId: "c1",
      score: 50,
      velocity: 10,
      metricsSource: "measured",
    });
    const estimated = makeVideo({
      id: "e",
      channelId: "c2",
      score: 50,
      velocity: 20,
      metricsSource: "estimated",
    });

    expect(compareBuzzRankedVideos(measured, estimated)).toBeLessThan(0);
  });

  it("caps videos per channel at 5 within top 100", () => {
    const videos = Array.from({ length: 8 }, (_, index) =>
      makeVideo({
        id: `v${index}`,
        channelId: "same-channel",
        score: 100 - index,
        velocity: 100 - index,
      }),
    );

    const capped = applyBuzzChannelCap(videos);
    expect(capped).toHaveLength(5);
  });

  it("does not relax quality to fill 100 slots", () => {
    const ranked = [
      ...Array.from({ length: 120 }, (_, index) =>
        makeVideo({
          id: `good-${index}`,
          channelId: `channel-${index}`,
          score: 80,
          velocity: 50,
        }),
      ),
      makeVideo({ id: "bad", channelId: "channel-x", score: 0, velocity: 10 }),
    ];

    const finalList = finalizeBuzzRankingList(ranked, "24h");
    expect(finalList.every((video) => video.metrics.rankingScore > 0)).toBe(true);
    expect(finalList.every((video) => video.metrics.viewVelocity > 0)).toBe(true);
    expect(finalList.length).toBeLessThanOrEqual(100);
  });

  it("audits top 100 measured rate and distributions", () => {
    const videos = [
      makeVideo({
        id: "1",
        channelId: "c1",
        score: 90,
        velocity: 10,
        metricsSource: "measured",
        categoryId: "20",
        contentKind: "regular",
      }),
      makeVideo({
        id: "2",
        channelId: "c2",
        score: 80,
        velocity: 8,
        metricsSource: "estimated",
        categoryId: "10",
        contentKind: "short",
      }),
    ];

    const audit = auditBuzzTop100(videos);
    expect(audit.displayCount).toBe(2);
    expect(audit.measuredCount).toBe(1);
    expect(audit.measuredRate).toBe(0.5);
    expect(audit.uniqueChannelCount).toBe(2);
    expect(audit.scoreZeroCount).toBe(0);
    expect(audit.categoryDistribution["20"]).toBe(1);
    expect(audit.classificationDistribution.short).toBe(1);
  });
});
