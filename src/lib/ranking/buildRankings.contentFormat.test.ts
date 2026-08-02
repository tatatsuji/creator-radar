import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildRankings } from "@/lib/ranking/buildRankings";
import { countRankingShorts } from "@/lib/ranking/rankingContentFormat";
import type { Video } from "@/types";

vi.mock("@/lib/ranking/snapshotRankingBase", () => ({
  getBuzzRankingCandidatesFromDb: vi.fn(),
  getMeasuredRankingCandidates: vi.fn(),
  enrichVideosWithSnapshots: vi.fn(),
  getMeasuredPromotionVideos: vi.fn((enriched: { video: Video }[]) => enriched),
}));

vi.mock("@/lib/ranking/buzzRankingFallback", () => ({
  getBuzzRankingFallbackCandidates: vi.fn(),
}));

vi.mock("@/lib/ranking/engines/buzzRanking", () => ({
  buildBuzzRankingVideos: vi.fn(async (videos: Video[]) => videos),
}));

vi.mock("@/lib/ranking/engines/earlyRiseRanking", () => ({
  buildEarlyRiseRankingVideos: vi.fn((enriched: { video: Video }[]) =>
    enriched.map((entry) => entry.video),
  ),
}));

vi.mock("@/lib/ranking/engines/launchSpeedRanking", () => ({
  buildLaunchSpeedRankingVideos: vi.fn((enriched: { video: Video }[]) =>
    enriched.map((entry) => entry.video),
  ),
}));

vi.mock("@/lib/ranking/engines/potentialRanking", () => ({
  buildPotentialRankingVideos: vi.fn((enriched: { video: Video }[]) =>
    enriched.map((entry) => entry.video),
  ),
}));

vi.mock("@/lib/ranking/earlyRiseScore", () => ({
  countEarlyRiseEligible: vi.fn(() => 10),
}));

vi.mock("@/lib/ranking/potentialScore", () => ({
  countPotentialEligible: vi.fn(() => 10),
}));

import {
  enrichVideosWithSnapshots,
  getBuzzRankingCandidatesFromDb,
  getMeasuredRankingCandidates,
} from "@/lib/ranking/snapshotRankingBase";
import { getBuzzRankingFallbackCandidates } from "@/lib/ranking/buzzRankingFallback";
import { buildBuzzRankingVideos } from "@/lib/ranking/engines/buzzRanking";

function makeVideo(
  id: string,
  contentKind: Video["contentKind"],
  durationSeconds?: number,
): Video {
  return {
    id,
    title: id,
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    contentKind,
    durationSeconds,
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

const mixedCandidates = [
  makeVideo("regular-1", "regular", 600),
  makeVideo("short-1", "short", 30),
  makeVideo("live-1", "live", 0),
  makeVideo("unknown-short", "unknown", 40),
];

describe("buildRankings content format isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBuzzRankingFallbackCandidates).mockResolvedValue([]);
    vi.mocked(enrichVideosWithSnapshots).mockImplementation(async (videos) =>
      videos.map((video) => ({
        video,
        snapshots: [],
        promotionMetrics: {
          snapshotQuality: "measured",
          v1h: 100,
        } as never,
        promotionState: null,
      })),
    );
  });

  it("returns no shorts in buzz ranking", async () => {
    vi.mocked(getBuzzRankingCandidatesFromDb).mockResolvedValue(mixedCandidates);
    vi.mocked(buildBuzzRankingVideos).mockImplementation(async (videos) => videos);

    const result = await buildRankings("buzz", "24h", "all", "all");

    expect(result.videos.map((video) => video.id)).toEqual(["regular-1"]);
    expect(countRankingShorts(result.videos)).toBe(0);
  });

  it("returns no shorts in early_rise ranking", async () => {
    vi.mocked(getMeasuredRankingCandidates).mockResolvedValue(mixedCandidates);

    const result = await buildRankings("early_rise", "24h", "all", "all");

    expect(result.videos.map((video) => video.id)).toEqual(["regular-1"]);
    expect(countRankingShorts(result.videos)).toBe(0);
  });

  it("returns no shorts in launch_speed ranking", async () => {
    vi.mocked(getMeasuredRankingCandidates).mockResolvedValue(mixedCandidates);

    const result = await buildRankings("launch_speed", "24h", "all", "all");

    expect(result.videos.map((video) => video.id)).toEqual(["regular-1"]);
    expect(countRankingShorts(result.videos)).toBe(0);
  });

  it("returns no shorts in potential ranking", async () => {
    vi.mocked(getMeasuredRankingCandidates).mockResolvedValue(mixedCandidates);

    const result = await buildRankings("potential", "24h", "all", "all");

    expect(result.videos.map((video) => video.id)).toEqual(["regular-1"]);
    expect(countRankingShorts(result.videos)).toBe(0);
  });

  it("returns no shorts in genre buzz ranking", async () => {
    vi.mocked(getBuzzRankingCandidatesFromDb).mockResolvedValue(mixedCandidates);
    vi.mocked(buildBuzzRankingVideos).mockImplementation(async (videos) => videos);

    const result = await buildRankings("buzz", "24h", "game", "all");

    expect(result.videos.map((video) => video.id)).toEqual(["regular-1"]);
    expect(countRankingShorts(result.videos)).toBe(0);
  });

  it("returns only shorts in shorts ranking", async () => {
    vi.mocked(getBuzzRankingCandidatesFromDb).mockResolvedValue(mixedCandidates);
    vi.mocked(buildBuzzRankingVideos).mockImplementation(async (videos) => videos);

    const result = await buildRankings("buzz", "24h", "shorts", "all");

    expect(result.videos.map((video) => video.id)).toEqual(["short-1"]);
  });

  it("returns only live videos in live ranking", async () => {
    vi.mocked(getBuzzRankingCandidatesFromDb).mockResolvedValue(mixedCandidates);
    vi.mocked(buildBuzzRankingVideos).mockImplementation(async (videos) => videos);

    const result = await buildRankings("buzz", "24h", "all", "live");

    expect(result.videos.map((video) => video.id)).toEqual(["live-1"]);
  });

  it("applies the same filter on YouTube fallback path", async () => {
    vi.mocked(getBuzzRankingCandidatesFromDb).mockResolvedValue([]);
    vi.mocked(getBuzzRankingFallbackCandidates).mockResolvedValue(mixedCandidates);
    vi.mocked(buildBuzzRankingVideos).mockImplementation(async (videos) => videos);

    const result = await buildRankings("buzz", "24h", "all", "all");

    expect(result.usedYouTubeFallback).toBe(true);
    expect(result.videos.map((video) => video.id)).toEqual(["regular-1"]);
    expect(countRankingShorts(result.videos)).toBe(0);
  });
});
