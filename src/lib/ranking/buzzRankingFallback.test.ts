import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  estimateBuzzFallbackQuotaUnits,
  getBuzzRankingFallbackCandidates,
  getBuzzRankingFallbackDailyFetchCount,
  resetBuzzRankingFallbackState,
} from "@/lib/ranking/buzzRankingFallback";
import type { Video } from "@/types";

vi.mock("@/lib/youtube/rankings", () => ({
  getRankingCandidates: vi.fn(),
}));

import { getRankingCandidates } from "@/lib/youtube/rankings";

function makeVideo(id: string): Video {
  return {
    id,
    title: id,
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: "2026-07-26T00:00:00.000Z",
    channel: {
      id: "UC1234567890abcdefghij",
      name: "Channel",
      subscriberCount: 1000,
    },
    viewCount: 1000,
    metrics: {
      period: "24h",
      viewDelta: 100,
      viewVelocity: 10,
      viewsPerSubscriber: 0.1,
      rankingScore: 50,
      metricsSource: "estimated",
    },
  };
}

describe("buzzRankingFallback", () => {
  beforeEach(() => {
    resetBuzzRankingFallbackState();
    vi.mocked(getRankingCandidates).mockReset();
  });

  it("uses cache within TTL and avoids repeated YouTube fetches", async () => {
    vi.mocked(getRankingCandidates).mockResolvedValue([makeVideo("video1234567")]);

    const first = await getBuzzRankingFallbackCandidates("24h", "all");
    const second = await getBuzzRankingFallbackCandidates("24h", "all");

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(getRankingCandidates).toHaveBeenCalledTimes(1);
    expect(getBuzzRankingFallbackDailyFetchCount()).toBe(1);
  });

  it("documents fallback quota cost", () => {
    expect(estimateBuzzFallbackQuotaUnits()).toBe(202);
  });
});
