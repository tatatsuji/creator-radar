import { describe, expect, it, vi } from "vitest";

import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import type { ChannelWatchlistRow } from "@/types/database";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

function makeWatchlistRow(channelId: string): ChannelWatchlistRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    channel_id: channelId,
    name: "Sample",
    category: "gaming",
    source: "manual_seed",
    priority: 10,
    notes: null,
    watch_tier: "normal",
    watch_status: "seed",
    next_check_at: "2026-07-24T00:00:00.000Z",
    last_checked_at: null,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
  };
}

describe("runWatchlistDiscovery", () => {
  it("stores discoveries and finishes a discovery run", async () => {
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
    const markChecked = vi.fn().mockResolvedValue(undefined);
    const touchLastUploadAt = vi.fn().mockResolvedValue(true);
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchlistDiscovery({
      getDueChannels: vi
        .fn()
        .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
      acquireLock: vi
        .fn()
        .mockResolvedValue({ channelId: "UC1234567890abcdefghij", lockToken: "lock-1" }),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchUploadVideos: vi.fn().mockResolvedValue({
        items: [
          {
            id: "video123456",
            snippet: {
              title: "Latest upload",
              channelId: "UC1234567890abcdefghij",
              channelTitle: "Sample",
              publishedAt: "2026-07-24T00:00:00.000Z",
              thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
            },
            contentDetails: { duration: "PT10M30S" },
            statistics: { viewCount: "1000" },
          },
          {
            id: "video123457",
            snippet: {
              title: "Second upload",
              channelId: "UC1234567890abcdefghij",
              channelTitle: "Sample",
              publishedAt: "2026-07-23T00:00:00.000Z",
              thumbnails: { default: { url: "https://example.com/thumb2.jpg" } },
            },
            contentDetails: { duration: "PT5M" },
            statistics: { viewCount: "500" },
          },
        ],
        quotaUsed: 3,
      }),
      fetchChannels: vi.fn().mockResolvedValue(new Map()),
      upsertChannel: vi.fn().mockResolvedValue(undefined),
      registerDiscoveryCandidate,
      markChecked,
      markFailure: vi.fn().mockResolvedValue(1),
      touchLastUploadAt,
      findRunningRun: vi.fn().mockResolvedValue(null),
      startRun: vi.fn().mockResolvedValue("run-1"),
      finishRun,
    });

    expect(result.status).toBe("success");
    expect(result.channelsProcessed).toBe(1);
    expect(result.videosDiscovered).toBe(2);
    expect(result.discoveriesInserted).toBe(1);
    expect(result.discoveriesDuplicate).toBe(1);
    expect(registerDiscoveryCandidate).toHaveBeenCalledTimes(2);
    expect(markChecked).toHaveBeenCalledWith(
      "UC1234567890abcdefghij",
      "normal",
    );
    expect(touchLastUploadAt).toHaveBeenCalledWith(
      "UC1234567890abcdefghij",
      "2026-07-24T00:00:00.000Z",
    );
    expect(finishRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        status: "success",
        itemsProcessed: 1,
        itemsDiscovered: 1,
        youtubeQuotaEstimate: 3,
      }),
    );
  });

  it("records failures via markFailure without marking checked", async () => {
    const markChecked = vi.fn();
    const markFailure = vi.fn().mockResolvedValue(2);

    const result = await runWatchlistDiscovery({
      getDueChannels: vi
        .fn()
        .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
      acquireLock: vi
        .fn()
        .mockResolvedValue({ channelId: "UC1234567890abcdefghij", lockToken: "lock-1" }),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchUploadVideos: vi
        .fn()
        .mockRejectedValue(new Error("YouTube API unavailable")),
      fetchChannels: vi.fn(),
      upsertChannel: vi.fn(),
      registerDiscoveryCandidate: vi.fn(),
      markChecked,
      markFailure,
      touchLastUploadAt: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      startRun: vi.fn().mockResolvedValue("run-3"),
      finishRun: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.channelsFailed).toBe(1);
    expect(markFailure).toHaveBeenCalledWith("UC1234567890abcdefghij");
    expect(markChecked).not.toHaveBeenCalled();
  });

  it("only processes channels returned by getDueChannels", async () => {
    const getDueChannels = vi.fn().mockResolvedValue([]);
    const fetchUploadVideos = vi.fn();

    await runWatchlistDiscovery({
      getDueChannels,
      acquireLock: vi.fn(),
      releaseLock: vi.fn(),
      fetchUploadVideos,
      fetchChannels: vi.fn(),
      upsertChannel: vi.fn(),
      registerDiscoveryCandidate: vi.fn(),
      markChecked: vi.fn(),
      markFailure: vi.fn(),
      touchLastUploadAt: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      startRun: vi.fn().mockResolvedValue("run-4"),
      finishRun: vi.fn().mockResolvedValue(undefined),
    });

    expect(getDueChannels).toHaveBeenCalled();
    expect(fetchUploadVideos).not.toHaveBeenCalled();
  });

  it("skips locked channels without failing the whole run", async () => {
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchlistDiscovery({
      getDueChannels: vi
        .fn()
        .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
      acquireLock: vi.fn().mockResolvedValue(null),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchUploadVideos: vi.fn(),
      fetchChannels: vi.fn(),
      upsertChannel: vi.fn(),
      registerDiscoveryCandidate: vi.fn(),
      markChecked: vi.fn(),
      markFailure: vi.fn(),
      touchLastUploadAt: vi.fn(),
      findRunningRun: vi.fn().mockResolvedValue(null),
      startRun: vi.fn().mockResolvedValue("run-2"),
      finishRun,
    });

    expect(result.status).toBe("failed");
    expect(result.channelsProcessed).toBe(0);
    expect(result.channelsFailed).toBe(1);
    expect(result.errors[0]).toContain("locked");
  });
});
