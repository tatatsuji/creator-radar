import { describe, expect, it } from "vitest";

import {
  filterDueWatchlistChannels,
  isWatchlistLockActive,
  isWatchlistPollingEligible,
} from "@/lib/watchlist/repository";
import type { ChannelWatchlistRow } from "@/types/database";

function makeRow(
  overrides: Partial<ChannelWatchlistRow> & Pick<ChannelWatchlistRow, "channel_id">,
): ChannelWatchlistRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Sample",
    category: "gaming",
    source: "manual_seed",
    priority: 1,
    notes: null,
    watch_tier: "normal",
    watch_status: "seed",
    next_check_at: null,
    last_checked_at: null,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("watchlist lock helpers", () => {
  const nowMs = Date.parse("2026-07-24T12:00:00.000Z");

  it("detects active locks", () => {
    expect(isWatchlistLockActive(null, nowMs)).toBe(false);
    expect(isWatchlistLockActive("2026-07-24T13:00:00.000Z", nowMs)).toBe(true);
    expect(isWatchlistLockActive("2026-07-24T11:00:00.000Z", nowMs)).toBe(false);
  });

  it("filters due and unlocked channels", () => {
    const rows = [
      makeRow({
        channel_id: "UCdue00000000000000001",
        next_check_at: "2026-07-24T11:00:00.000Z",
      }),
      makeRow({
        channel_id: "UClocked00000000000002",
        next_check_at: "2026-07-24T11:00:00.000Z",
        locked_until: "2026-07-24T13:00:00.000Z",
      }),
      makeRow({
        channel_id: "UCfuture00000000000003",
        next_check_at: "2026-07-24T13:00:00.000Z",
      }),
      makeRow({
        channel_id: "UCarchive00000000000004",
        watch_tier: "archive",
        next_check_at: "2026-07-24T11:00:00.000Z",
      }),
    ];

    const due = filterDueWatchlistChannels(rows, 10, nowMs);
    expect(due.map((row) => row.channel_id)).toEqual([
      "UCdue00000000000000001",
    ]);
  });

  it("excludes archive tier from polling eligibility", () => {
    expect(
      isWatchlistPollingEligible({
        watch_status: "active",
        watch_tier: "archive",
      }),
    ).toBe(false);
    expect(
      isWatchlistPollingEligible({
        watch_status: "active",
        watch_tier: "hot",
      }),
    ).toBe(true);
  });
});
