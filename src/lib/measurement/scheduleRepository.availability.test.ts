import { describe, expect, it, vi } from "vitest";

import { getDueVideos } from "@/lib/measurement/scheduleRepository";
import type { MeasurementScheduleRow } from "@/types/database";

vi.mock("@/lib/video/videoAvailabilityRepository", () => ({
  listDeletedOrPrivateVideoIds: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: vi.fn(),
}));

import { listDeletedOrPrivateVideoIds } from "@/lib/video/videoAvailabilityRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("getDueVideos deleted_or_private exclusion", () => {
  it("excludes deleted_or_private videos from measurement due list", async () => {
    const rows: MeasurementScheduleRow[] = [
      {
        video_id: "active-video",
        measurement_tier: "hot",
        measurement_status: "pending",
        next_measurement_at: null,
        last_measured_at: null,
        failure_count: 0,
        lock_token: null,
        locked_until: null,
        created_at: "2026-07-24T00:00:00.000Z",
        updated_at: "2026-07-24T00:00:00.000Z",
      },
      {
        video_id: "deleted-video",
        measurement_tier: "hot",
        measurement_status: "pending",
        next_measurement_at: null,
        last_measured_at: null,
        failure_count: 0,
        lock_token: null,
        locked_until: null,
        created_at: "2026-07-24T00:00:00.000Z",
        updated_at: "2026-07-24T00:00:00.000Z",
      },
    ];

    vi.mocked(listDeletedOrPrivateVideoIds).mockResolvedValue(
      new Set(["deleted-video"]),
    );

    vi.mocked(createSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    } as never);

    const due = await getDueVideos(10);

    expect(due.map((row) => row.video_id)).toEqual(["active-video"]);
  });
});
