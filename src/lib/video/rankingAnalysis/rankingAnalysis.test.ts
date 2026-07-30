import { describe, expect, it } from "vitest";

import { buildBuzzRankingAnalysis } from "@/lib/video/rankingAnalysis/buzzAnalysis";
import { buildEarlyRiseRankingAnalysis } from "@/lib/video/rankingAnalysis/earlyRiseAnalysis";
import { buildEngagementStats } from "@/lib/video/rankingAnalysis/facts";
import { getRankingOptimizedAnalysis } from "@/lib/video/rankingAnalysis";
import type { VideoAnalysisInput } from "@/lib/video/rankingAnalysis/types";
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

function buildInput(video: Video): VideoAnalysisInput {
  return {
    video,
    period: "24h",
    engagement: buildEngagementStats(50_000, 2_500, 120),
    promotionMetrics: {
      videoId: video.id,
      snapshotQuality: "measured",
      v1h: 500,
      v3h: 420,
      v24h: 300,
      acceleration: 0.2,
      velocityChangeAbsolute: 80,
      velocityChangeRate: 0.2,
      accelerationPerHour: 10,
      selfRollingAvg1h: 400,
      selfZScore: 1.2,
      genreZScore: null,
      viewsPerSubscriber1h: 0.05,
      discoveryAgeHours: 12,
      absoluteSizePenalty: 0,
      measuredSampleCount: 4,
    },
  };
}

describe("buildBuzzRankingAnalysis", () => {
  it("returns a lead answer and optional details without jargon", () => {
    const analysis = buildBuzzRankingAnalysis(buildInput(buildVideo()));

    expect(analysis.kind).toBe("buzz");
    expect(analysis.leadAnswer).toContain("再生");
    expect(analysis.leadAnswer).not.toContain("初速");
    expect(analysis.details.length).toBeLessThanOrEqual(2);
    expect(analysis.disclaimer).toBe("公開データと計測値から自動生成しています。");
  });

  it("uses estimated wording and disclaimer when metrics are estimated", () => {
    const analysis = buildBuzzRankingAnalysis(
      buildInput(
        buildVideo({
          metrics: {
            period: "24h",
            viewDelta: 5_000,
            viewVelocity: 208,
            viewsPerSubscriber: 5,
            rankingScore: 72,
            metricsSource: "estimated",
          },
        }),
      ),
    );

    expect(analysis.leadAnswer).toContain("推定されます");
    expect(analysis.leadAnswer).not.toContain("再生増");
    expect(analysis.disclaimer).toBe("公開データをもとに自動推定しています。");
  });
});

describe("buildEarlyRiseRankingAnalysis", () => {
  it("orders output as facts and hypotheses without duplicate reference points", () => {
    const analysis = buildEarlyRiseRankingAnalysis(buildInput(buildVideo()));

    expect(analysis.kind).toBe("early_rise");
    expect(analysis.facts.length).toBeLessThanOrEqual(4);
    expect(analysis.hypotheses.length).toBeGreaterThan(0);
    expect(analysis.hypotheses.length).toBeLessThanOrEqual(3);
    expect(analysis.hypotheses.every((item) => item.text.includes("可能性"))).toBe(
      true,
    );
    expect("referencePoints" in analysis).toBe(false);
  });
});

describe("getRankingOptimizedAnalysis", () => {
  it("returns buzz analysis for buzz ranking", () => {
    const analysis = getRankingOptimizedAnalysis(buildInput(buildVideo()), "buzz");
    expect(analysis.kind).toBe("buzz");
  });

  it("returns early rise analysis for early_rise ranking", () => {
    const analysis = getRankingOptimizedAnalysis(
      buildInput(buildVideo()),
      "early_rise",
    );
    expect(analysis.kind).toBe("early_rise");
  });
});

describe("buildEngagementStats", () => {
  it("computes like and comment rates", () => {
    const stats = buildEngagementStats(10_000, 500, 50);
    expect(stats.likeRate).toBe(0.05);
    expect(stats.commentRate).toBe(0.005);
  });
});
