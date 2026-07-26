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
    const upsertVideo = vi.fn().mockResolvedValue(undefined);
    const recordDiscovery = vi
      .fn()
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("duplicate");
    const upsertSchedule = vi.fn().mockResolvedValue({ videoId: "video123456", status: "created" });
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
        videos: [
          {
            videoId: "video123456",
            title: "Latest upload",
            channelId: "UC1234567890abcdefghij",
            channelName: "Sample",
            publishedAt: "2026-07-24T00:00:00.000Z",
            thumbnailUrl: "https://example.com/thumb.jpg",
          },
          {
            videoId: "video123457",
            title: "Second upload",
            channelId: "UC1234567890abcdefghij",
            channelName: "Sample",
            publishedAt: "2026-07-23T00:00:00.000Z",
            thumbnailUrl: "https://example.com/thumb2.jpg",
          },
        ],
        quotaUsed: 3,
      }),
      upsertChannel: vi.fn().mockResolvedValue(undefined),
      upsertVideo,
      recordDiscovery,
      upsertSchedule,
      markChecked: vi.fn().mockResolvedValue(undefined),
      incrementFailure: vi.fn().mockResolvedValue(undefined),
      findRunningRun: vi.fn().mockResolvedValue(null),
      startRun: vi.fn().mockResolvedValue("run-1"),
      finishRun,
    });

    expect(result.status).toBe("success");
    expect(result.channelsProcessed).toBe(1);
    expect(result.videosDiscovered).toBe(2);
    expect(result.discoveriesInserted).toBe(1);
    expect(result.discoveriesDuplicate).toBe(1);
    expect(upsertVideo).toHaveBeenCalledTimes(2);
    expect(recordDiscovery).toHaveBeenCalledTimes(2);
    expect(upsertSchedule).toHaveBeenCalledTimes(2);
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

  it("skips locked channels without failing the whole run", async () => {
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchlistDiscovery({
      getDueChannels: vi
        .fn()
        .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
      acquireLock: vi.fn().mockResolvedValue(null),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      fetchUploadVideos: vi.fn(),
      upsertChannel: vi.fn(),
      upsertVideo: vi.fn(),
      recordDiscovery: vi.fn(),
      upsertSchedule: vi.fn(),
      markChecked: vi.fn(),
      incrementFailure: vi.fn(),
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
