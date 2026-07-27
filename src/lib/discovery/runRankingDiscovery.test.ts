import { describe, expect, it, vi } from "vitest";

import { runRankingDiscovery } from "@/lib/discovery/runRankingDiscovery";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

describe("runRankingDiscovery", () => {
  it("registers ranking candidates and finishes a ranking_generation run", async () => {
    const finishRun = vi.fn().mockResolvedValue(undefined);

    const result = await runRankingDiscovery({
      findRunningRun: vi.fn().mockResolvedValue(null),
      startRun: vi.fn().mockResolvedValue("run-ranking-1"),
      finishRun,
      fetchCandidates: vi.fn().mockResolvedValue([
        {
          id: "video1234567",
          snippet: {
            channelId: "UC1234567890abcdefghij",
            channelTitle: "Sample",
            title: "Buzz candidate",
            publishedAt: "2026-07-26T00:00:00.000Z",
            thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
            liveBroadcastContent: "none",
          },
        },
      ]),
      registerCandidates: vi.fn().mockResolvedValue({
        candidatesProcessed: 1,
        candidatesSkipped: 0,
        videosInserted: 1,
        videosUpdated: 0,
        discoveriesInserted: 1,
        discoveriesDuplicate: 0,
        schedulesCreated: 1,
        schedulesExisting: 0,
        failures: 0,
      }),
    });

    expect(result.status).toBe("success");
    expect(result.schedulesCreated).toBe(1);
    expect(finishRun).toHaveBeenCalledWith(
      "run-ranking-1",
      expect.objectContaining({
        status: "success",
        itemsDiscovered: 1,
      }),
    );
  });
});
