import { describe, expect, it, vi } from "vitest";

import {
  buildBuzzRegistrationSource,
  registerBuzzCandidatesFromVideos,
  shouldUseHotMeasurementTier,
} from "@/lib/discovery/buzzCandidateRegistration";
import type { Video } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

function makeVideo(id: string): Video {
  return {
    id,
    title: `Video ${id}`,
    description: "",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    channel: {
      id: "UC1234567890abcdefghij",
      name: "Sample Channel",
      subscriberCount: 1000,
      subscriberCountHidden: false,
    },
    viewCount: 120_000,
    metrics: {
      period: "24h",
      viewDelta: 1000,
      viewVelocity: 500,
      viewsPerSubscriber: 1,
      rankingScore: 80,
      metricsSource: "estimated",
    },
  };
}

describe("buzzCandidateRegistration", () => {
  it("builds a stable search source key for all-genre ranking registration", () => {
    expect(buildBuzzRegistrationSource({ period: "24h", genre: "all" })).toEqual({
      sourceType: "search",
      sourceKey: expect.stringMatching(/^q:/),
    });
  });

  it("registers new buzz candidates without duplicating schedules", async () => {
    const registerDiscoveryCandidate = vi
      .fn()
      .mockResolvedValueOnce({
        videoInserted: true,
        discoveryInserted: true,
        scheduleCreated: true,
      })
      .mockResolvedValueOnce({
        videoInserted: false,
        discoveryInserted: false,
        scheduleCreated: false,
      });

    const result = await registerBuzzCandidatesFromVideos(
      [makeVideo("video1234567"), makeVideo("video1234568")],
      { period: "24h", genre: "all", limit: 10 },
      {
        findExistingVideoIds: vi.fn().mockResolvedValue(new Set(["video1234568"])),
        registerDiscoveryCandidate,
      },
    );

    expect(result).toMatchObject({
      candidatesProcessed: 2,
      videosInserted: 1,
      videosUpdated: 1,
      discoveriesInserted: 1,
      discoveriesDuplicate: 1,
      schedulesCreated: 1,
      schedulesExisting: 1,
      failures: 0,
    });
    expect(registerDiscoveryCandidate).toHaveBeenCalledTimes(2);
  });

  it("marks recent high-view videos as hot candidates", () => {
    expect(
      shouldUseHotMeasurementTier({
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        viewCount: 10_000,
      }),
    ).toBe(true);
    expect(
      shouldUseHotMeasurementTier({
        publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        viewCount: 10_000,
      }),
    ).toBe(false);
  });
});
