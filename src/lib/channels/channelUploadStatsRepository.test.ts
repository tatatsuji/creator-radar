import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: vi.fn(),
}));

import { touchChannelLastUploadAtIfNewer } from "@/lib/channels/channelUploadStatsRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("touchChannelLastUploadAtIfNewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates last_upload_at when the new published_at is newer", async () => {
    const update = vi.fn().mockReturnValue({ error: null });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { last_upload_at: "2026-07-20T00:00:00.000Z" },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => ({ error: null })),
      }),
    });

    vi.mocked(createSupabaseServerClient).mockReturnValue({ from } as never);

    const updated = await touchChannelLastUploadAtIfNewer(
      "UC1234567890abcdefghij",
      "2026-07-24T00:00:00.000Z",
    );

    expect(updated).toBe(true);
    expect(from).toHaveBeenCalledWith("channels");
  });

  it("does not overwrite last_upload_at with an older published_at", async () => {
    const update = vi.fn();
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { last_upload_at: "2026-07-24T12:00:00.000Z" },
            error: null,
          }),
        }),
      }),
      update,
    });

    vi.mocked(createSupabaseServerClient).mockReturnValue({ from } as never);

    const updated = await touchChannelLastUploadAtIfNewer(
      "UC1234567890abcdefghij",
      "2026-07-24T00:00:00.000Z",
    );

    expect(updated).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
