import { describe, expect, it } from "vitest";

import {
  computeNextWatchlistCheckAt,
  determineInitialWatchTier,
  getWatchTierCheckIntervalMs,
} from "@/lib/watchlist/watchTier";
import type { PollableWatchTier } from "@/lib/watchlist/watchTierConfig";

describe("determineInitialWatchTier", () => {
  const thresholds = {
    hot: 1_000_000,
    active: 500_000,
    normal: 100_000,
  };

  it("maps subscriber counts to initial watch tiers", () => {
    expect(determineInitialWatchTier(1_500_000, thresholds)).toBe("hot");
    expect(determineInitialWatchTier(1_000_000, thresholds)).toBe("hot");
    expect(determineInitialWatchTier(750_000, thresholds)).toBe("active");
    expect(determineInitialWatchTier(500_000, thresholds)).toBe("active");
    expect(determineInitialWatchTier(250_000, thresholds)).toBe("normal");
    expect(determineInitialWatchTier(100_000, thresholds)).toBe("normal");
    expect(determineInitialWatchTier(50_000, thresholds)).toBe("cold");
    expect(determineInitialWatchTier(9_999, thresholds)).toBe("cold");
  });

  it("defaults unknown subscriber counts to cold", () => {
    expect(determineInitialWatchTier(null, thresholds)).toBe("cold");
    expect(determineInitialWatchTier(undefined, thresholds)).toBe("cold");
  });
});

describe("watch tier check intervals", () => {
  const intervals: Record<PollableWatchTier, number> = {
    hot: 1 * 60 * 60 * 1000,
    active: 3 * 60 * 60 * 1000,
    normal: 6 * 60 * 60 * 1000,
    cold: 12 * 60 * 60 * 1000,
  };

  it("schedules next_check_at by watch_tier", () => {
    const from = new Date("2026-07-24T00:00:00.000Z");

    expect(computeNextWatchlistCheckAt("hot", from, intervals).toISOString()).toBe(
      "2026-07-24T01:00:00.000Z",
    );
    expect(computeNextWatchlistCheckAt("active", from, intervals).toISOString()).toBe(
      "2026-07-24T03:00:00.000Z",
    );
    expect(computeNextWatchlistCheckAt("normal", from, intervals).toISOString()).toBe(
      "2026-07-24T06:00:00.000Z",
    );
    expect(computeNextWatchlistCheckAt("cold", from, intervals).toISOString()).toBe(
      "2026-07-24T12:00:00.000Z",
    );
    expect(getWatchTierCheckIntervalMs("active", intervals)).toBe(
      3 * 60 * 60 * 1000,
    );
  });

  it("rejects archive tier for polling intervals", () => {
    expect(() => getWatchTierCheckIntervalMs("archive", intervals as never)).toThrow(
      "archive tier is excluded from watchlist polling",
    );
  });
});
