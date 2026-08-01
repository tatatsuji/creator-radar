import { describe, expect, it, vi } from "vitest";

import { getRankingsPayload } from "@/lib/ranking/getRankingsPayload";
import { countRankingShorts } from "@/lib/ranking/rankingContentFormat";
import type { Video } from "@/types";

vi.mock("@/lib/ranking/buildRankings", () => ({
  buildRankings: vi.fn(),
}));

vi.mock("@/lib/snapshots/repository", () => ({
  fetchSnapshotsForVideos: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

import { buildRankings } from "@/lib/ranking/buildRankings";

function makeVideo(id: string, contentKind: Video["contentKind"]): Video {
  return {
    id,
    title: id,
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    contentKind,
    channel: {
      id: "channel",
      name: "Channel",
      subscriberCount: 1000,
      subscriberCountHidden: false,
    },
    viewCount: 1000,
    metrics: {
      period: "24h",
      viewDelta: 100,
      viewVelocity: 10,
      viewsPerSubscriber: 0.1,
      rankingScore: 50,
      metricsSource: "measured",
    },
  };
}

describe("getRankingsPayload SSR/API consistency", () => {
  it("returns the same filtered ranking payload for repeated calls", async () => {
    vi.mocked(buildRankings).mockResolvedValue({
      ranking: "buzz",
      videos: [makeVideo("regular-1", "regular")],
      readiness: {
        status: "ready",
        eligibleCount: 1,
        requiredCount: 1,
        message: "",
      },
      metricsSummary: { measured: 1, estimated: 0 },
    });

    const first = await getRankingsPayload("buzz", "24h", "all", "all");
    const second = await getRankingsPayload("buzz", "24h", "all", "all");

    expect(second).toEqual(first);
    expect(countRankingShorts(first.videos)).toBe(0);
    expect(buildRankings).toHaveBeenCalledWith("buzz", "24h", "all", "all");
  });
});
