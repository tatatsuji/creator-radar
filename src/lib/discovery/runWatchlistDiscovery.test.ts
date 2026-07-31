import { describe, expect, it, vi } from "vitest";

import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import type { WatchlistDiscoveryDeps } from "@/lib/discovery/runWatchlistDiscovery";
import { resolveWatchlistPollMode } from "@/lib/websub/watchlistPollPolicy";
import type { WebsubSubscriptionRecord } from "@/lib/websub/websubSubscriptionRepository";
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

const NOW = new Date("2026-07-31T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function mockWebsubSubscription(
  overrides: Partial<WebsubSubscriptionRecord> = {},
): WebsubSubscriptionRecord {
  return {
    id: "sub-1",
    youtube_channel_id: "UC1234567890abcdefghij",
    topic_url:
      "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC1234567890abcdefghij",
    hub_url: "https://pubsubhubbub.appspot.com/subscribe",
    callback_url: "https://example.com/api/websub/callback",
    status: "active",
    subscription_health: "healthy",
    lease_expires_at: null,
    secret_version: 1,
    subscribe_attempt_count: 0,
    last_subscribe_at: null,
    last_verified_at: null,
    last_notification_at: null,
    last_error: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makeDiscoveryDeps(
  overrides: Partial<WatchlistDiscoveryDeps> = {},
): WatchlistDiscoveryDeps {
  return {
    getDueChannels: vi.fn(async () => []),
    acquireLock: vi.fn(async () => null),
    releaseLock: vi.fn(async () => undefined),
    fetchUploadVideos: vi.fn(async () => ({ items: [], quotaUsed: 0 })),
    fetchSafetyPollVideos: vi.fn(async () => ({ items: [], quotaUsed: 1 })),
    fetchChannels: vi.fn(async () => new Map()),
    upsertChannel: vi.fn(async () => undefined),
    registerDiscoveryCandidate: vi.fn(async () => ({
      videoInserted: false,
      discoveryInserted: false,
      scheduleCreated: false,
    })),
    markChecked: vi.fn(async () => undefined),
    markFailure: vi.fn(async () => 0),
    touchLastUploadAt: vi.fn(async () => true),
    findRunningRun: vi.fn(async () => null),
    startRun: vi.fn(async () => "run-1"),
    finishRun: vi.fn(async () => undefined),
    isWebsubEnabled: vi.fn(() => false),
    getWebsubSubscription: vi.fn(async () => null),
    resolvePollMode: resolveWatchlistPollMode,
    updateNextCheckAt: vi.fn(async () => undefined),
    now: vi.fn(() => NOW),
    ...overrides,
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

    const result = await runWatchlistDiscovery(
      makeDiscoveryDeps({
        getDueChannels: vi
          .fn()
          .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
        acquireLock: vi
          .fn()
          .mockResolvedValue({
            channelId: "UC1234567890abcdefghij",
            lockToken: "lock-1",
          }),
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
                thumbnails: {
                  default: { url: "https://example.com/thumb.jpg" },
                },
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
                thumbnails: {
                  default: { url: "https://example.com/thumb2.jpg" },
                },
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
      }),
    );

    expect(result.status).toBe("success");
    expect(result.channelsProcessed).toBe(1);
    expect(result.videosDiscovered).toBe(2);
    expect(result.discoveriesInserted).toBe(1);
    expect(result.discoveriesDuplicate).toBe(1);
    expect(registerDiscoveryCandidate).toHaveBeenCalledTimes(2);
    expect(markChecked).toHaveBeenCalledWith(
      "UC1234567890abcdefghij",
      "normal",
      undefined,
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

    const result = await runWatchlistDiscovery(
      makeDiscoveryDeps({
        getDueChannels: vi
          .fn()
          .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
        acquireLock: vi
          .fn()
          .mockResolvedValue({
            channelId: "UC1234567890abcdefghij",
            lockToken: "lock-1",
          }),
        fetchUploadVideos: vi
          .fn()
          .mockRejectedValue(new Error("YouTube API unavailable")),
        markChecked,
        markFailure,
        findRunningRun: vi.fn().mockResolvedValue(null),
        startRun: vi.fn().mockResolvedValue("run-3"),
      }),
    );

    expect(result.channelsFailed).toBe(1);
    expect(markFailure).toHaveBeenCalledWith("UC1234567890abcdefghij");
    expect(markChecked).not.toHaveBeenCalled();
  });

  it("only processes channels returned by getDueChannels", async () => {
    const getDueChannels = vi.fn().mockResolvedValue([]);
    const fetchUploadVideos = vi.fn();

    await runWatchlistDiscovery(
      makeDiscoveryDeps({
        getDueChannels,
        fetchUploadVideos,
        findRunningRun: vi.fn().mockResolvedValue(null),
        startRun: vi.fn().mockResolvedValue("run-4"),
      }),
    );

    expect(getDueChannels).toHaveBeenCalled();
    expect(fetchUploadVideos).not.toHaveBeenCalled();
  });

  it("skips locked channels without failing the whole run", async () => {
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchlistDiscovery(
      makeDiscoveryDeps({
        getDueChannels: vi
          .fn()
          .mockResolvedValue([makeWatchlistRow("UC1234567890abcdefghij")]),
        acquireLock: vi.fn().mockResolvedValue(null),
        finishRun,
        findRunningRun: vi.fn().mockResolvedValue(null),
        startRun: vi.fn().mockResolvedValue("run-2"),
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.channelsProcessed).toBe(0);
    expect(result.channelsFailed).toBe(1);
    expect(result.errors[0]).toContain("locked");
  });

  it("skips normal poll for healthy WebSub subscriptions", async () => {
    const fetchUploadVideos = vi.fn();
    const updateNextCheckAt = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchlistDiscovery(
      makeDiscoveryDeps({
        isWebsubEnabled: vi.fn(() => true),
        getWebsubSubscription: vi.fn(async () =>
          mockWebsubSubscription({ subscription_health: "healthy" }),
        ),
        getDueChannels: vi.fn().mockResolvedValue([
          {
            ...makeWatchlistRow("UC1234567890abcdefghij"),
            last_checked_at: new Date(NOW.getTime() - 12 * HOUR_MS).toISOString(),
          },
        ]),
        acquireLock: vi.fn().mockResolvedValue({
          channelId: "UC1234567890abcdefghij",
          lockToken: "lock-1",
        }),
        fetchUploadVideos,
        updateNextCheckAt,
      }),
    );

    expect(result.channelsSkippedWebsubHealthy).toBe(1);
    expect(fetchUploadVideos).not.toHaveBeenCalled();
    expect(updateNextCheckAt).toHaveBeenCalled();
  });

  it("runs normal poll for degraded WebSub subscriptions", async () => {
    const fetchUploadVideos = vi.fn().mockResolvedValue({
      items: [],
      quotaUsed: 2,
    });

    const result = await runWatchlistDiscovery(
      makeDiscoveryDeps({
        isWebsubEnabled: vi.fn(() => true),
        getWebsubSubscription: vi.fn(async () =>
          mockWebsubSubscription({ subscription_health: "degraded" }),
        ),
        getDueChannels: vi.fn().mockResolvedValue([
          makeWatchlistRow("UC1234567890abcdefghij"),
        ]),
        acquireLock: vi.fn().mockResolvedValue({
          channelId: "UC1234567890abcdefghij",
          lockToken: "lock-1",
        }),
        fetchUploadVideos,
      }),
    );

    expect(result.channelsNormalPoll).toBe(1);
    expect(fetchUploadVideos).toHaveBeenCalledWith("UC1234567890abcdefghij");
  });

  it("runs normal poll for expired WebSub subscriptions", async () => {
    const fetchUploadVideos = vi.fn().mockResolvedValue({
      items: [],
      quotaUsed: 2,
    });

    await runWatchlistDiscovery(
      makeDiscoveryDeps({
        isWebsubEnabled: vi.fn(() => true),
        getWebsubSubscription: vi.fn(async () =>
          mockWebsubSubscription({
            subscription_health: "unhealthy",
            status: "expired",
          }),
        ),
        getDueChannels: vi.fn().mockResolvedValue([
          makeWatchlistRow("UC1234567890abcdefghij"),
        ]),
        acquireLock: vi.fn().mockResolvedValue({
          channelId: "UC1234567890abcdefghij",
          lockToken: "lock-1",
        }),
        fetchUploadVideos,
      }),
    );

    expect(fetchUploadVideos).toHaveBeenCalled();
  });

  it("runs safety poll with one playlist item for healthy subscriptions due after 24h", async () => {
    const fetchSafetyPollVideos = vi.fn().mockResolvedValue({
      items: [
        {
          id: "video123456",
          snippet: {
            title: "Safety upload",
            channelId: "UC1234567890abcdefghij",
            channelTitle: "Sample",
            publishedAt: "2026-07-30T12:00:00.000Z",
            thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
          },
        },
      ],
      quotaUsed: 1,
    });
    const fetchUploadVideos = vi.fn();
    const markChecked = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchlistDiscovery(
      makeDiscoveryDeps({
        isWebsubEnabled: vi.fn(() => true),
        getWebsubSubscription: vi.fn(async () =>
          mockWebsubSubscription({ subscription_health: "healthy" }),
        ),
        getDueChannels: vi.fn().mockResolvedValue([
          {
            ...makeWatchlistRow("UC1234567890abcdefghij"),
            last_checked_at: new Date(NOW.getTime() - DAY_MS - HOUR_MS).toISOString(),
          },
        ]),
        acquireLock: vi.fn().mockResolvedValue({
          channelId: "UC1234567890abcdefghij",
          lockToken: "lock-1",
        }),
        fetchSafetyPollVideos,
        fetchUploadVideos,
        markChecked,
      }),
    );

    expect(result.channelsSafetyPoll).toBe(1);
    expect(fetchSafetyPollVideos).toHaveBeenCalledWith("UC1234567890abcdefghij");
    expect(fetchUploadVideos).not.toHaveBeenCalled();
    expect(markChecked).toHaveBeenCalledWith(
      "UC1234567890abcdefghij",
      "normal",
      expect.objectContaining({ nextCheckAt: expect.any(Date) }),
    );
  });

  it("keeps existing behavior when WebSub is disabled", async () => {
    const fetchUploadVideos = vi.fn().mockResolvedValue({
      items: [],
      quotaUsed: 2,
    });

    await runWatchlistDiscovery(
      makeDiscoveryDeps({
        isWebsubEnabled: vi.fn(() => false),
        getDueChannels: vi.fn().mockResolvedValue([
          makeWatchlistRow("UC1234567890abcdefghij"),
        ]),
        acquireLock: vi.fn().mockResolvedValue({
          channelId: "UC1234567890abcdefghij",
          lockToken: "lock-1",
        }),
        fetchUploadVideos,
      }),
    );

    expect(fetchUploadVideos).toHaveBeenCalled();
  });

  it("uses normal poll when WebSub is enabled but channel is unregistered", async () => {
    const fetchUploadVideos = vi.fn().mockResolvedValue({
      items: [],
      quotaUsed: 2,
    });

    await runWatchlistDiscovery(
      makeDiscoveryDeps({
        isWebsubEnabled: vi.fn(() => true),
        getWebsubSubscription: vi.fn(async () => null),
        getDueChannels: vi.fn().mockResolvedValue([
          makeWatchlistRow("UC1234567890abcdefghij"),
        ]),
        acquireLock: vi.fn().mockResolvedValue({
          channelId: "UC1234567890abcdefghij",
          lockToken: "lock-1",
        }),
        fetchUploadVideos,
      }),
    );

    expect(fetchUploadVideos).toHaveBeenCalled();
  });
});
