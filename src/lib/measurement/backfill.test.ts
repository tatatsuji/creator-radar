import { describe, expect, it, vi } from "vitest";

import { formatMeasurementBackfillSummary } from "@/lib/measurement/backfill";

vi.mock("@/lib/measurement/scheduleRepository", () => ({
  listUnscheduledCandidateVideoIds: vi
    .fn()
    .mockResolvedValue(["video-a", "video-b"]),
  upsertSchedulesBatch: vi.fn().mockResolvedValue({
    created: 2,
    exists: 0,
    failed: 0,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

describe("measurement backfill", () => {
  it("supports dry-run", async () => {
    const { backfillMeasurementSchedules } = await import("@/lib/measurement/backfill");
    const summary = await backfillMeasurementSchedules({ dryRun: true });
    expect(summary.dryRun).toBe(true);
    expect(summary.toCreate).toBe(2);
    expect(summary.created).toBe(0);
  });

  it("formats summary output", () => {
    const text = formatMeasurementBackfillSummary({
      dryRun: false,
      candidateVideoIds: 2,
      toCreate: 2,
      created: 2,
      exists: 0,
      failed: 0,
      videoIds: ["video-a", "video-b"],
    });
    expect(text).toContain("Created: 2");
  });
});
