import { describe, expect, it } from "vitest";

import { buildEarlyRiseRankingVideos } from "@/lib/ranking/engines/earlyRiseRanking";
import { buildLaunchSpeedRankingVideos } from "@/lib/ranking/engines/launchSpeedRanking";
import { buildPotentialRankingVideos } from "@/lib/ranking/engines/potentialRanking";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import type { Video } from "@/types";

function makeVideo(id: string, publishedAt: string): Video {
  return {
    id,
    title: `Video ${id}`,
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt,
    channel: {
      id: "channel-1",
      name: "Channel",
      subscriberCount: 1000,
    },
    viewCount: 10000,
    metrics: {
      period: "24h",
      viewDelta: 1000,
      viewVelocity: 100,
      viewsPerSubscriber: 0.1,
      rankingScore: 50,
      metricsSource: "measured",
    },
  };
}

function makeMetrics(
  overrides: Partial<NonNullable<SnapshotEnrichedVideo["promotionMetrics"]>> = {},
): NonNullable<SnapshotEnrichedVideo["promotionMetrics"]> {
  return {
    videoId: "test",
    snapshotQuality: "measured",
    v1h: 1000,
    v3h: 1500,
    v24h: 4000,
    acceleration: 0.5,
    velocityChangeAbsolute: 200,
    velocityChangeRate: 0.5,
    accelerationPerHour: 50,
    selfRollingAvg1h: 400,
    selfZScore: 1,
    genreZScore: null,
    viewsPerSubscriber1h: 1,
    discoveryAgeHours: 6,
    absoluteSizePenalty: 4,
    measuredSampleCount: 3,
    ...overrides,
  };
}

function makeEnriched(
  id: string,
  publishedAt: string,
  metrics: NonNullable<SnapshotEnrichedVideo["promotionMetrics"]>,
  snapshotCount = 3,
): SnapshotEnrichedVideo {
  return {
    video: makeVideo(id, publishedAt),
    snapshots: Array.from({ length: snapshotCount }, (_, index) => ({
      id: `${id}-${index}`,
      video_id: id,
      view_count: 100 + index * 50,
      like_count: 10 + index,
      comment_count: 1,
      subscriber_count: 1000,
      captured_at: new Date(Date.now() - (snapshotCount - index) * 3 * 60 * 60 * 1000).toISOString(),
    })),
    promotionMetrics: metrics,
    promotionState: "RISING",
  };
}

describe("snapshot ranking engines", () => {
  it("sorts early rise by early rise score", () => {
    const ranked = buildEarlyRiseRankingVideos([
      makeEnriched("a", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "a",
        v1h: 1000,
        v3h: 1500,
        acceleration: 0.5,
        velocityChangeAbsolute: 200,
        velocityChangeRate: 0.5,
      })),
      makeEnriched("b", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "b",
        v1h: 2000,
        v3h: 3000,
        acceleration: 1.2,
        velocityChangeAbsolute: 800,
        velocityChangeRate: 1.2,
      })),
    ]);

    expect(ranked[0]?.id).toBe("b");
    expect(ranked[0]?.rankingDisplay?.scoreName).toBe("加速スコア");
  });

  it("filters launch speed to recent videos", () => {
    const ranked = buildLaunchSpeedRankingVideos([
      makeEnriched("recent", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "recent",
        v1h: 5000,
      })),
      makeEnriched("old", new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "old",
        v1h: 9000,
      })),
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.id).toBe("recent");
  });

  it("builds potential ranking with measured score", () => {
    const ranked = buildPotentialRankingVideos([
      makeEnriched("p1", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "p1",
        v1h: 3000,
        v3h: 2800,
        v24h: 2500,
        acceleration: 0.2,
        velocityChangeAbsolute: 100,
        velocityChangeRate: 0.2,
      }), 4),
    ]);

    expect(ranked[0]?.rankingDisplay?.scoreName).toBe("伸び予測スコア");
    expect(ranked[0]?.rankingDisplay?.scoreValue).not.toBeNull();
    expect(ranked[0]?.rankingDisplay?.rankReason).not.toContain("安定推移");
  });

  it("orders early rise and potential differently for the same pool", () => {
    const entries = [
      makeEnriched("spike", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "spike",
        v1h: 5000,
        v3h: 2000,
        acceleration: 2,
        velocityChangeAbsolute: 3000,
        velocityChangeRate: 2,
        selfRollingAvg1h: 800,
      }), 3),
      makeEnriched("steady", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), makeMetrics({
        videoId: "steady",
        v1h: 2500,
        v3h: 2400,
        v24h: 2300,
        acceleration: 0.1,
        velocityChangeAbsolute: 100,
        velocityChangeRate: 0.1,
        selfRollingAvg1h: 2300,
      }), 5),
    ];

    const earlyRise = buildEarlyRiseRankingVideos(entries);
    const potential = buildPotentialRankingVideos(entries);

    expect(earlyRise[0]?.id).toBe("spike");
    expect(potential[0]?.id).toBe("steady");
  });
});
