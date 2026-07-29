import { describe, expect, it, vi } from "vitest";

import { runDiscoveryCron } from "@/lib/discovery/runDiscoveryCron";

vi.mock("@/lib/discovery/runWatchlistDiscovery", () => ({
  runWatchlistDiscovery: vi.fn(),
}));

vi.mock("@/lib/discovery/candidateDiscoveryEngine", () => ({
  runCandidateDiscoveryEngine: vi.fn(),
}));

import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import { runCandidateDiscoveryEngine } from "@/lib/discovery/candidateDiscoveryEngine";

const watchlistSuccess = {
  runId: "wl-1",
  status: "success" as const,
  channelsDue: 1,
  channelsProcessed: 1,
  channelsFailed: 0,
  videosDiscovered: 2,
  discoveriesInserted: 2,
  discoveriesDuplicate: 0,
  youtubeQuotaEstimate: 10,
  errors: [],
};

const candidateSuccess = {
  runId: "cd-1",
  status: "success" as const,
  totalFetched: 10,
  totalRegistered: 5,
  sources: [],
  dbRemeasure: {
    candidatesProcessed: 0,
    schedulesCreated: 0,
    schedulesExisting: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    failures: 0,
  },
  youtubeQuotaEstimate: 100,
  errors: [],
};

describe("runDiscoveryCron", () => {
  it("runs candidate discovery when watchlist fails", async () => {
    vi.mocked(runWatchlistDiscovery).mockRejectedValue(new Error("watchlist down"));
    vi.mocked(runCandidateDiscoveryEngine).mockResolvedValue(candidateSuccess);

    const result = await runDiscoveryCron();

    expect(result.watchlist.status).toBe("failed");
    expect(result.watchlist.errors[0]).toContain("watchlist down");
    expect(result.candidateDiscovery).toEqual(candidateSuccess);
    expect(result.candidateDiscoveryError).toBeNull();
  });

  it("returns candidate error without throwing when candidate engine fails", async () => {
    vi.mocked(runWatchlistDiscovery).mockResolvedValue(watchlistSuccess);
    vi.mocked(runCandidateDiscoveryEngine).mockRejectedValue(new Error("quota exceeded"));

    const result = await runDiscoveryCron();

    expect(result.watchlist).toEqual(watchlistSuccess);
    expect(result.candidateDiscovery).toBeNull();
    expect(result.candidateDiscoveryError).toBe("quota exceeded");
  });
});
