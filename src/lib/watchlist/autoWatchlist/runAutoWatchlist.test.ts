import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

import { runAutoWatchlist } from "@/lib/watchlist/autoWatchlist/runAutoWatchlist";

describe("runAutoWatchlist", () => {
  it("promotes, demotes, and restores channels in a single batch run", async () => {
    const applyDecision = vi.fn().mockResolvedValue(undefined);

    const result = await runAutoWatchlist(
      {
        findRunningRun: vi.fn().mockResolvedValue(null),
        startRun: vi.fn().mockResolvedValue("run-auto-1"),
        finishRun: vi.fn().mockResolvedValue(undefined),
        listChannels: vi.fn().mockResolvedValue([
          {
            id: "1",
            channel_id: "UCpromote000000000001",
            name: "Promote",
            category: null,
            source: "auto_watchlist",
            priority: 0,
            notes: null,
            watch_tier: "cold",
            watch_status: "discovered",
            next_check_at: null,
            last_checked_at: null,
            failure_count: 0,
            lock_token: null,
            locked_until: null,
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
          {
            id: "2",
            channel_id: "UCdemote00000000000002",
            name: "Demote",
            category: null,
            source: "auto_watchlist",
            priority: 0,
            notes: null,
            watch_tier: "hot",
            watch_status: "active",
            next_check_at: null,
            last_checked_at: null,
            failure_count: 0,
            lock_token: null,
            locked_until: null,
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
          {
            id: "3",
            channel_id: "UCrestore0000000000003",
            name: "Restore",
            category: null,
            source: "auto_watchlist",
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
          },
        ]),
        loadMetrics: vi.fn().mockResolvedValue(
          new Map([
            [
              "UCpromote000000000001",
              {
                channelId: "UCpromote000000000001",
                performanceDiscoveryCount: 5,
                rankingDiscoveryCount: 0,
                risingDiscoveryCount: 0,
                distinctPerformanceVideoCount: 5,
                lastUploadAt: "2026-07-30T00:00:00.000Z",
              },
            ],
            [
              "UCdemote00000000000002",
              {
                channelId: "UCdemote00000000000002",
                performanceDiscoveryCount: 0,
                rankingDiscoveryCount: 0,
                risingDiscoveryCount: 0,
                distinctPerformanceVideoCount: 0,
                lastUploadAt: "2026-05-01T00:00:00.000Z",
              },
            ],
            [
              "UCrestore0000000000003",
              {
                channelId: "UCrestore0000000000003",
                performanceDiscoveryCount: 1,
                rankingDiscoveryCount: 1,
                risingDiscoveryCount: 0,
                distinctPerformanceVideoCount: 1,
                lastUploadAt: null,
              },
            ],
          ]),
        ),
        applyDecision,
      },
      Date.parse("2026-07-31T00:00:00.000Z"),
    );

    expect(result.promoted).toBe(1);
    expect(result.demoted).toBe(1);
    expect(result.restored).toBe(1);
    expect(applyDecision).toHaveBeenCalledTimes(3);
  });
});
