import { describe, expect, it, vi } from "vitest";

import { recordDiscovery } from "@/lib/discovery/repository";

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

describe("candidate discovery repository", () => {
  it("validates discovery input before insert", async () => {
    await expect(
      recordDiscovery({
        videoId: "",
        sourceType: "watchlist_upload",
        sourceKey: "UC1234567890abcdefghij",
      }),
    ).rejects.toThrow(/videoId/);
  });

  it("returns duplicate on unique constraint errors", async () => {
    mockInsert.mockReturnValueOnce({
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await recordDiscovery({
      videoId: "video123456",
      channelId: "UC1234567890abcdefghij",
      sourceType: "watchlist_upload",
      sourceKey: "UC1234567890abcdefghij",
    });

    expect(result).toBe("duplicate");
  });

  it("inserts a valid discovery row", async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    const result = await recordDiscovery({
      videoId: "video123456",
      channelId: "UC1234567890abcdefghij",
      sourceType: "watchlist_upload",
      sourceKey: "UC1234567890abcdefghij",
    });

    expect(result).toBe("inserted");
    expect(mockFrom).toHaveBeenCalledWith("candidate_discoveries");
  });
});
