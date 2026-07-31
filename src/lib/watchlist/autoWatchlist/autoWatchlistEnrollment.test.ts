import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  autoEnrollDiscoveredChannel,
  restoreArchiveChannelOnDiscovery,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistEnrollment";

vi.mock("@/lib/watchlist/repository", () => ({
  insertWatchlistChannelIfAbsent: vi.fn(),
  getWatchlistChannelById: vi.fn(),
  updateWatchlistTierAndStatus: vi.fn(),
}));

import {
  getWatchlistChannelById,
  insertWatchlistChannelIfAbsent,
  updateWatchlistTierAndStatus,
} from "@/lib/watchlist/repository";

describe("autoEnrollDiscoveredChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enrolls an unregistered channel discovered by the candidate engine", async () => {
    vi.mocked(insertWatchlistChannelIfAbsent).mockResolvedValue("inserted");

    const result = await autoEnrollDiscoveredChannel({
      channelId: "UC1234567890abcdefghij",
      channelName: "Sample Channel",
      sourceType: "search",
      subscriberCount: 50_000,
    });

    expect(result).toBe("enrolled");
    expect(insertWatchlistChannelIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "UC1234567890abcdefghij",
        source: "auto_watchlist",
        watchStatus: "discovered",
        watchTier: "cold",
      }),
    );
  });

  it("skips duplicate watchlist channels", async () => {
    vi.mocked(insertWatchlistChannelIfAbsent).mockResolvedValue("exists");

    const result = await autoEnrollDiscoveredChannel({
      channelId: "UC1234567890abcdefghij",
      sourceType: "search",
    });

    expect(result).toBe("exists");
  });

  it("skips watchlist-managed discovery sources", async () => {
    const result = await autoEnrollDiscoveredChannel({
      channelId: "UC1234567890abcdefghij",
      sourceType: "watchlist_upload",
    });

    expect(result).toBe("skipped");
    expect(insertWatchlistChannelIfAbsent).not.toHaveBeenCalled();
  });
});

describe("restoreArchiveChannelOnDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores archive channels when a new ranking discovery is inserted", async () => {
    vi.mocked(getWatchlistChannelById).mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      channel_id: "UC1234567890abcdefghij",
      name: "Sample",
      category: null,
      source: "manual_seed",
      priority: 0,
      notes: null,
      watch_tier: "archive",
      watch_status: "active",
      next_check_at: null,
      last_checked_at: null,
      failure_count: 0,
      lock_token: null,
      locked_until: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });

    const restored = await restoreArchiveChannelOnDiscovery({
      channelId: "UC1234567890abcdefghij",
      sourceType: "search",
      discoveryInserted: true,
      discoveredAt: "2026-07-31T00:00:00.000Z",
    });

    expect(restored).toBe(true);
    expect(updateWatchlistTierAndStatus).toHaveBeenCalledWith(
      "UC1234567890abcdefghij",
      "cold",
      "active",
    );
  });

  it("does not restore non-archive channels", async () => {
    vi.mocked(getWatchlistChannelById).mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      channel_id: "UC1234567890abcdefghij",
      name: "Sample",
      category: null,
      source: "manual_seed",
      priority: 0,
      notes: null,
      watch_tier: "normal",
      watch_status: "active",
      next_check_at: null,
      last_checked_at: null,
      failure_count: 0,
      lock_token: null,
      locked_until: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });

    const restored = await restoreArchiveChannelOnDiscovery({
      channelId: "UC1234567890abcdefghij",
      sourceType: "search",
      discoveryInserted: true,
    });

    expect(restored).toBe(false);
    expect(updateWatchlistTierAndStatus).not.toHaveBeenCalled();
  });
});
