import { describe, expect, it, vi } from "vitest";

import {
  finishDiscoveryRun,
  startDiscoveryRun,
} from "@/lib/discovery/runsRepository";

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

describe("discovery runs repository", () => {
  it("starts a run with discovery-v1 algorithm version", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "run-123" }, error: null });

    const runId = await startDiscoveryRun("watchlist_check");

    expect(runId).toBe("run-123");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        run_type: "watchlist_check",
        algorithm_version: "discovery-v1",
        status: "running",
      }),
    );
  });

  it("finishes a run with counts and status", async () => {
    await finishDiscoveryRun("run-123", {
      status: "success",
      itemsProcessed: 2,
      itemsDiscovered: 5,
      itemsFailed: 0,
      youtubeQuotaEstimate: 6,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        items_processed: 2,
        items_discovered: 5,
        youtube_quota_estimate: 6,
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "run-123");
  });
});
