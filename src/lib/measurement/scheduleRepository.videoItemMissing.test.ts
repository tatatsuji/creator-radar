import { describe, expect, it, vi } from "vitest";

import { markMeasurementVideoItemMissing } from "@/lib/measurement/scheduleRepository";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("markMeasurementVideoItemMissing", () => {
  it("reschedules by tier without changing failure_count or status", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const from = vi.fn().mockReturnValue({ update });

    vi.mocked(createSupabaseServerClient).mockReturnValue({ from } as never);

    const measuredAt = new Date("2026-07-24T12:00:00.000Z");
    await markMeasurementVideoItemMissing("video-1", "hot", measuredAt);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        next_measurement_at: "2026-07-24T13:00:00.000Z",
        lock_token: null,
        locked_until: null,
      }),
    );
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("failure_count");
    expect(payload).not.toHaveProperty("measurement_status");
  });
});
