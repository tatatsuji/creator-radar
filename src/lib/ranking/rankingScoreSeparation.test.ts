import { describe, expect, it } from "vitest";

import {
  calculateEarlyRiseScore,
  isEarlyRiseEligible,
} from "@/lib/ranking/earlyRiseScore";
import {
  calculatePotentialScore,
  isPotentialEligible,
} from "@/lib/ranking/potentialScore";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import type { Video } from "@/types";

function makeVideo(id: string): Video {
  return {
    id,
    title: id,
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
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

function makeEntry(
  id: string,
  metrics: NonNullable<SnapshotEnrichedVideo["promotionMetrics"]>,
  viewCounts: number[],
): SnapshotEnrichedVideo {
  const baseMs = Date.now() - viewCounts.length * 3 * 60 * 60 * 1000;

  return {
    video: makeVideo(id),
    snapshots: viewCounts.map((viewCount, index) => ({
      id: `${id}-${index}`,
      video_id: id,
      view_count: viewCount,
      like_count: 10 + index * 2,
      comment_count: 1 + index,
      subscriber_count: 1000,
      captured_at: new Date(baseMs + index * 3 * 60 * 60 * 1000).toISOString(),
    })),
    promotionMetrics: metrics,
    promotionState: "RISING",
  };
}

describe("earlyRiseScore", () => {
  it("prefers a sudden spike over steady growth", () => {
    const spike = makeEntry(
      "spike",
      {
        videoId: "spike",
        snapshotQuality: "measured",
        v1h: 5000,
        v3h: 2000,
        v24h: 1500,
        acceleration: 2,
        velocityChangeAbsolute: 3000,
        velocityChangeRate: 2,
        accelerationPerHour: 900,
        selfRollingAvg1h: 900,
        selfZScore: 2,
        genreZScore: null,
        viewsPerSubscriber1h: 5,
        discoveryAgeHours: 12,
        absoluteSizePenalty: 4,
        measuredSampleCount: 3,
      },
      [100, 250, 900, 2400, 5000],
    );

    const steady = makeEntry(
      "steady",
      {
        videoId: "steady",
        snapshotQuality: "measured",
        v1h: 2500,
        v3h: 2400,
        v24h: 2300,
        acceleration: 0.1,
        velocityChangeAbsolute: 100,
        velocityChangeRate: 0.1,
        accelerationPerHour: 20,
        selfRollingAvg1h: 2300,
        selfZScore: 0.5,
        genreZScore: null,
        viewsPerSubscriber1h: 2.5,
        discoveryAgeHours: 12,
        absoluteSizePenalty: 4,
        measuredSampleCount: 5,
      },
      [100, 400, 800, 1200, 1600, 2000],
    );

    expect(isEarlyRiseEligible(spike)).toBe(true);
    expect(isEarlyRiseEligible(steady)).toBe(true);
    expect(calculateEarlyRiseScore(spike).score!).toBeGreaterThan(
      calculateEarlyRiseScore(steady).score!,
    );
  });
});

describe("potentialScore", () => {
  it("prefers sustained growth over a one-interval spike", () => {
    const spike = makeEntry(
      "spike",
      {
        videoId: "spike",
        snapshotQuality: "measured",
        v1h: 5000,
        v3h: 2000,
        v24h: 1500,
        acceleration: 2,
        velocityChangeAbsolute: 3000,
        velocityChangeRate: 2,
        accelerationPerHour: 900,
        selfRollingAvg1h: 900,
        selfZScore: 2,
        genreZScore: null,
        viewsPerSubscriber1h: 5,
        discoveryAgeHours: 12,
        absoluteSizePenalty: 4,
        measuredSampleCount: 3,
      },
      [100, 250, 900, 2400, 5000],
    );

    const steady = makeEntry(
      "steady",
      {
        videoId: "steady",
        snapshotQuality: "measured",
        v1h: 2500,
        v3h: 2400,
        v24h: 2300,
        acceleration: 0.1,
        velocityChangeAbsolute: 100,
        velocityChangeRate: 0.1,
        accelerationPerHour: 20,
        selfRollingAvg1h: 2300,
        selfZScore: 0.5,
        genreZScore: null,
        viewsPerSubscriber1h: 2.5,
        discoveryAgeHours: 12,
        absoluteSizePenalty: 4,
        measuredSampleCount: 5,
      },
      [100, 400, 800, 1200, 1600, 2000],
    );

    const pool = [spike, steady];

    expect(isPotentialEligible(spike)).toBe(true);
    expect(isPotentialEligible(steady)).toBe(true);
    expect(calculatePotentialScore(steady, pool).score!).toBeGreaterThan(
      calculatePotentialScore(spike, pool).score!,
    );
  });
});

describe("acceleration semantics", () => {
  it("returns zero change for flat 1h and 3h velocities", () => {
    const entry = makeEntry(
      "flat",
      {
        videoId: "flat",
        snapshotQuality: "measured",
        v1h: 100,
        v3h: 100,
        v24h: 100,
        acceleration: 0,
        velocityChangeAbsolute: 0,
        velocityChangeRate: 0,
        accelerationPerHour: 0,
        selfRollingAvg1h: 100,
        selfZScore: 0,
        genreZScore: null,
        viewsPerSubscriber1h: 0.1,
        discoveryAgeHours: 12,
        absoluteSizePenalty: 4,
        measuredSampleCount: 4,
      },
      [100, 200, 300, 400],
    );

    expect(entry.promotionMetrics?.velocityChangeRate).toBe(0);
  });
});
