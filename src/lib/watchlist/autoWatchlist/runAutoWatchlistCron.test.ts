import { describe, expect, it } from "vitest";

import { runAutoWatchlistCron } from "@/lib/watchlist/autoWatchlist/runAutoWatchlistCron";
import { runCandidateDiscoveryCron } from "@/lib/discovery/runCandidateDiscoveryCron";
import { runWatchlistDiscoveryCron } from "@/lib/discovery/runWatchlistDiscoveryCron";

describe("isolated cron entrypoints", () => {
  it("exports watchlist-only and candidate-only cron wrappers", () => {
    expect(typeof runWatchlistDiscoveryCron).toBe("function");
    expect(typeof runCandidateDiscoveryCron).toBe("function");
    expect(typeof runAutoWatchlistCron).toBe("function");
  });
});
