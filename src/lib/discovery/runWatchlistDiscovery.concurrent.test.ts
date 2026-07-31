import { describe, expect, it, vi } from "vitest";

import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

describe("runWatchlistDiscovery concurrent guard", () => {
  it("rejects when another discovery run is already in progress", async () => {
    await expect(
      runWatchlistDiscovery({
        getDueChannels: vi.fn(),
        acquireLock: vi.fn(),
        releaseLock: vi.fn(),
        fetchUploadVideos: vi.fn(),
        fetchChannels: vi.fn(),
        upsertChannel: vi.fn(),
        registerDiscoveryCandidate: vi.fn(),
        markChecked: vi.fn(),
        incrementFailure: vi.fn(),
        findRunningRun: vi.fn().mockResolvedValue({
          id: "running-discovery",
          status: "running",
        }),
        startRun: vi.fn(),
        finishRun: vi.fn(),
      }),
    ).rejects.toThrow("Discovery is already in progress.");
  });
});
