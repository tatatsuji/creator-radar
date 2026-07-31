import { beforeEach, describe, expect, it, vi } from "vitest";

import { upsertSchedule } from "@/lib/measurement/scheduleRepository";

vi.mock("@/lib/measurement/adaptiveMeasurementSignals", () => ({
  resolveInitialAdaptiveMeasurementTier: vi.fn().mockResolvedValue({
    tier: "critical",
    reason: "initial_freshPublishHours<=6",
  }),
  resolveAdaptiveMeasurementTier: vi.fn(),
}));

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
    })),
  })),
  insert: mockInsert,
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

describe("upsertSchedule", () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockInsert.mockReset();
    mockFrom.mockClear();
  });

  it("creates a new schedule with adaptive initial tier defaults", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockInsert.mockReturnValueOnce({ error: null });

    const result = await upsertSchedule("video-123456");

    expect(result.status).toBe("created");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        video_id: "video-123456",
        measurement_tier: "critical",
        measurement_status: "pending",
        failure_count: 0,
      }),
    );
  });

  it("does not reset an existing schedule", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { video_id: "video-123456" },
      error: null,
    });

    const result = await upsertSchedule("video-123456");

    expect(result.status).toBe("exists");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
