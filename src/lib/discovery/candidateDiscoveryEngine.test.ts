import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  finishDiscoveryRun: vi.fn().mockResolvedValue(undefined),
  registerBuzzCandidatesFromYouTubeItems: vi.fn().mockResolvedValue({
    candidatesProcessed: 0,
    candidatesSkipped: 0,
    videosInserted: 0,
    videosUpdated: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    schedulesCreated: 0,
    schedulesExisting: 0,
    failures: 0,
  }),
  registerDbRemeasureCandidates: vi.fn().mockResolvedValue({
    candidatesProcessed: 3,
    schedulesCreated: 1,
    schedulesExisting: 2,
    discoveriesInserted: 1,
    discoveriesDuplicate: 2,
    failures: 0,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/discovery/runsRepository", () => ({
  findRecentRunningDiscoveryRun: vi.fn().mockResolvedValue(null),
  startDiscoveryRun: vi.fn().mockResolvedValue("run-engine-1"),
  finishDiscoveryRun: mocks.finishDiscoveryRun,
}));

vi.mock("@/lib/youtube/candidateFetch", () => ({
  fetchCategoryDiscoveryItems: vi.fn().mockResolvedValue([]),
  fetchShortFormCandidateItems: vi.fn().mockResolvedValue([]),
  fetchShortsDiscoveryItems: vi.fn().mockResolvedValue([]),
  fetchLiveDiscoveryItems: vi.fn().mockResolvedValue([]),
  fetchMostPopularVideoItems: vi.fn().mockResolvedValue([]),
  estimateSearchQuotaUnits: (count: number) => count * 100,
  estimateVideosListQuotaUnits: (count: number) => Math.ceil(count / 50),
}));

vi.mock("@/lib/youtube/rankings", () => ({
  getRankingDiscoveryVideoItems: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/discovery/dbRemeasureDiscovery", () => ({
  registerDbRemeasureCandidates: mocks.registerDbRemeasureCandidates,
}));

vi.mock("@/lib/discovery/buzzCandidateRegistration", () => ({
  registerBuzzCandidatesFromYouTubeItems:
    mocks.registerBuzzCandidatesFromYouTubeItems,
}));

import { runCandidateDiscoveryEngine } from "@/lib/discovery/candidateDiscoveryEngine";

describe("runCandidateDiscoveryEngine", () => {
  it("finishes a ranking_generation run with db remeasure when fetchers are empty", async () => {
    const result = await runCandidateDiscoveryEngine(0);

    expect(result.status).toBe("success");
    expect(result.dbRemeasure.candidatesProcessed).toBe(3);
    expect(mocks.finishDiscoveryRun).toHaveBeenCalledWith(
      "run-engine-1",
      expect.objectContaining({
        status: "success",
      }),
    );
  });
});
