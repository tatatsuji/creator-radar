import { beforeEach, describe, expect, it, vi } from "vitest";

import { markMeasurementAdaptiveSuccess } from "@/lib/measurement/scheduleRepository";

const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/measurement/adaptiveMeasurementSignals", () => ({
  resolveAdaptiveMeasurementTier: vi.fn(),
  resolveInitialAdaptiveMeasurementTier: vi.fn(),
}));

vi.mock("@/lib/measurement/adaptiveMeasurementLogger", () => ({
  logAdaptiveMeasurementTierChange: vi.fn(),
}));

import { logAdaptiveMeasurementTierChange } from "@/lib/measurement/adaptiveMeasurementLogger";
import { resolveAdaptiveMeasurementTier } from "@/lib/measurement/adaptiveMeasurementSignals";

describe("markMeasurementAdaptiveSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it("logs tier changes and updates schedule with adaptive tier", async () => {
    vi.mocked(resolveAdaptiveMeasurementTier).mockResolvedValue({
      tier: "archive",
      reason: "v1h=0,viewsGainedSinceLastMeasure=0,hoursSinceLastMeasure=30",
      normalizedPreviousTier: "normal",
    });

    const measuredAt = new Date("2026-07-24T12:00:00.000Z");
    const result = await markMeasurementAdaptiveSuccess(
      "video-adaptive",
      "normal",
      100,
      "2026-07-23T06:00:00.000Z",
      measuredAt,
    );

    expect(resolveAdaptiveMeasurementTier).toHaveBeenCalledWith(
      "video-adaptive",
      "normal",
      100,
      "2026-07-23T06:00:00.000Z",
      measuredAt,
    );
    expect(logAdaptiveMeasurementTierChange).toHaveBeenCalledWith({
      videoId: "video-adaptive",
      previousTier: "normal",
      nextTier: "archive",
      reason: "v1h=0,viewsGainedSinceLastMeasure=0,hoursSinceLastMeasure=30",
    });
    expect(mockFrom).toHaveBeenCalledWith("measurement_schedule");
    expect(result).toEqual({
      previousTier: "normal",
      nextTier: "archive",
      reason: "v1h=0,viewsGainedSinceLastMeasure=0,hoursSinceLastMeasure=30",
      tierChanged: true,
    });
  });

  it("skips tier-change logging when adaptive tier is unchanged", async () => {
    vi.mocked(resolveAdaptiveMeasurementTier).mockResolvedValue({
      tier: "high",
      reason: "v1h=200,velocityChangeRate=0.8",
      normalizedPreviousTier: "high",
    });

    const result = await markMeasurementAdaptiveSuccess(
      "video-stable",
      "high",
      500,
      null,
      new Date("2026-07-24T12:00:00.000Z"),
    );

    expect(logAdaptiveMeasurementTierChange).not.toHaveBeenCalled();
    expect(result.tierChanged).toBe(false);
  });
});
