import { describe, expect, it, vi } from "vitest";

import { registerDiscoveryCandidate } from "@/lib/discovery/registerDiscoveryCandidate";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

describe("registerDiscoveryCandidate", () => {
  it("registers a candidate through the unified discovery path", async () => {
    const upsertVideo = vi.fn().mockResolvedValue(undefined);
    const upsertChannel = vi.fn().mockResolvedValue(undefined);
    const recordDiscovery = vi.fn().mockResolvedValue("inserted");
    const upsertSchedule = vi
      .fn()
      .mockResolvedValue({ videoId: "video1234567", status: "created" });

    const result = await registerDiscoveryCandidate(
      {
        video: {
          youtubeVideoId: "video1234567",
          title: "Sample",
          channelId: "UC1234567890abcdefghij",
          channelName: "Channel",
          thumbnailUrl: "https://example.com/thumb.jpg",
          publishedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          isShort: true,
        },
        channel: {
          youtubeChannelId: "UC1234567890abcdefghij",
          name: "Channel",
          subscriberCountHidden: false,
        },
        sourceType: "short_form_candidate",
        sourceKey: "q:phase1:short_form:24h",
        genreHint: "shorts",
        formatHint: "short",
        registrationPath: "candidate_discovery",
      },
      {
        upsertChannel,
        upsertVideo,
        recordDiscovery,
        upsertSchedule,
        findExistingVideoIds: vi.fn().mockResolvedValue(new Set()),
        autoEnrollChannel: vi.fn().mockResolvedValue("skipped"),
        restoreArchiveChannel: vi.fn().mockResolvedValue(false),
      },
    );

    expect(result).toEqual({
      videoInserted: true,
      discoveryInserted: true,
      scheduleCreated: true,
    });
    expect(recordDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "short_form_candidate",
        genreHint: "shorts",
        formatHint: "short",
      }),
    );
  });

  it("allows multiple discovery sources for the same video", async () => {
    const recordDiscovery = vi
      .fn()
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("inserted");
    const deps = {
      upsertChannel: vi.fn().mockResolvedValue(undefined),
      upsertVideo: vi.fn().mockResolvedValue(undefined),
      recordDiscovery,
      upsertSchedule: vi
        .fn()
        .mockResolvedValue({ videoId: "video1234567", status: "exists" }),
      findExistingVideoIds: vi
        .fn()
        .mockResolvedValueOnce(new Set())
        .mockResolvedValueOnce(new Set(["video1234567"])),
      autoEnrollChannel: vi.fn().mockResolvedValue("skipped"),
      restoreArchiveChannel: vi.fn().mockResolvedValue(false),
    };

    const baseInput = {
      video: {
        youtubeVideoId: "video1234567",
        title: "Sample",
        channelId: "UC1234567890abcdefghij",
        channelName: "Channel",
        thumbnailUrl: "https://example.com/thumb.jpg",
        publishedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
      channel: {
        youtubeChannelId: "UC1234567890abcdefghij",
        name: "Channel",
        subscriberCountHidden: false,
      },
      registrationPath: "candidate_discovery",
    } as const;

    await registerDiscoveryCandidate(
      {
        ...baseInput,
        sourceType: "search",
        sourceKey: "q:ranking:24h:all",
      },
      deps,
    );
    await registerDiscoveryCandidate(
      {
        ...baseInput,
        sourceType: "most_popular",
        sourceKey: "popular:JP:all",
      },
      deps,
    );

    expect(recordDiscovery).toHaveBeenCalledTimes(2);
    expect(recordDiscovery.mock.calls[0]?.[0]?.sourceType).toBe("search");
    expect(recordDiscovery.mock.calls[1]?.[0]?.sourceType).toBe("most_popular");
  });

  it("invokes auto watchlist hooks after discovery registration", async () => {
    const autoEnrollChannel = vi.fn().mockResolvedValue("enrolled");
    const restoreArchiveChannel = vi.fn().mockResolvedValue(false);

    await registerDiscoveryCandidate(
      {
        video: {
          youtubeVideoId: "video1234567",
          title: "Sample",
          channelId: "UC1234567890abcdefghij",
          channelName: "Channel",
          thumbnailUrl: "https://example.com/thumb.jpg",
          publishedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        channel: {
          youtubeChannelId: "UC1234567890abcdefghij",
          name: "Channel",
          subscriberCountHidden: false,
        },
        sourceType: "search",
        sourceKey: "q:ranking:24h:all",
      },
      {
        upsertChannel: vi.fn().mockResolvedValue(undefined),
        upsertVideo: vi.fn().mockResolvedValue(undefined),
        recordDiscovery: vi.fn().mockResolvedValue("inserted"),
        upsertSchedule: vi
          .fn()
          .mockResolvedValue({ videoId: "video1234567", status: "created" }),
        findExistingVideoIds: vi.fn().mockResolvedValue(new Set()),
        autoEnrollChannel,
        restoreArchiveChannel,
      },
    );

    expect(autoEnrollChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "UC1234567890abcdefghij",
        sourceType: "search",
      }),
    );
    expect(restoreArchiveChannel).toHaveBeenCalled();
  });
});
