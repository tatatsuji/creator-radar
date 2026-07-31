import { describe, expect, it } from "vitest";

import {
  computeWatchlistFailureBackoffMs,
  computeWatchlistFailureNextCheckAt,
} from "@/lib/watchlist/watchlistFailureBackoff";

describe("watchlist failure backoff", () => {
  const config = {
    after1: 1 * 60 * 60 * 1000,
    after2: 3 * 60 * 60 * 1000,
    after3: 6 * 60 * 60 * 1000,
    after4OrMore: 24 * 60 * 60 * 1000,
  };

  it("maps failure_count to backoff intervals", () => {
    expect(computeWatchlistFailureBackoffMs(1, config)).toBe(config.after1);
    expect(computeWatchlistFailureBackoffMs(2, config)).toBe(config.after2);
    expect(computeWatchlistFailureBackoffMs(3, config)).toBe(config.after3);
    expect(computeWatchlistFailureBackoffMs(4, config)).toBe(config.after4OrMore);
    expect(computeWatchlistFailureBackoffMs(10, config)).toBe(config.after4OrMore);
  });

  it("computes next_check_at from failure_count", () => {
    const from = new Date("2026-07-24T00:00:00.000Z");

    expect(
      computeWatchlistFailureNextCheckAt(from, 1, config).toISOString(),
    ).toBe("2026-07-24T01:00:00.000Z");
    expect(
      computeWatchlistFailureNextCheckAt(from, 2, config).toISOString(),
    ).toBe("2026-07-24T03:00:00.000Z");
    expect(
      computeWatchlistFailureNextCheckAt(from, 3, config).toISOString(),
    ).toBe("2026-07-24T06:00:00.000Z");
    expect(
      computeWatchlistFailureNextCheckAt(from, 4, config).toISOString(),
    ).toBe("2026-07-25T00:00:00.000Z");
  });
});
