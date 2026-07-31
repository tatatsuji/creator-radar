import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listWatchlistChannelIdsEligibleForWebsub,
  listWatchlistChannelsForWebsub,
} from "@/lib/websub/websubSubscriptionRepository";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => true),
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

function createWatchlistQueryBuilder(finalResult: {
  data: unknown;
  error: unknown;
}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "neq", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(finalResult).then(onFulfilled);
  return builder;
}

describe("listWatchlistChannelsForWebsub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns channel_id and watch_tier for eligible watchlist rows", async () => {
    const builder = createWatchlistQueryBuilder({
      data: [
        {
          channel_id: "UChot00000000000000001",
          watch_tier: "hot",
          watch_status: "active",
        },
        {
          channel_id: "UCcold00000000000000002",
          watch_tier: "cold",
          watch_status: "seed",
        },
      ],
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never);

    await expect(listWatchlistChannelsForWebsub()).resolves.toEqual([
      { channelId: "UChot00000000000000001", watchTier: "hot" },
      { channelId: "UCcold00000000000000002", watchTier: "cold" },
    ]);

    expect(builder.select).toHaveBeenCalledWith(
      "channel_id, watch_tier, watch_status",
    );
    expect(builder.neq).toHaveBeenCalledWith("watch_tier", "archive");
    expect(builder.in).toHaveBeenCalledWith("watch_status", [
      "seed",
      "discovered",
      "active",
    ]);
  });

  it("throws when channel_watchlist lookup fails", async () => {
    const builder = createWatchlistQueryBuilder({
      data: null,
      error: { message: "db unavailable" },
    });

    vi.mocked(createSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never);

    await expect(listWatchlistChannelsForWebsub()).rejects.toThrow(
      "channel_watchlist lookup failed: db unavailable",
    );
  });
});

describe("listWatchlistChannelIdsEligibleForWebsub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns channel ids only", async () => {
    const builder = createWatchlistQueryBuilder({
      data: [
        {
          channel_id: "UCaaa",
          watch_tier: "normal",
          watch_status: "discovered",
        },
      ],
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    } as never);

    await expect(listWatchlistChannelIdsEligibleForWebsub()).resolves.toEqual([
      "UCaaa",
    ]);
  });
});
