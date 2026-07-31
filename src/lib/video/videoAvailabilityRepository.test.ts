import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isVideoAvailabilityTrackingEnabled,
  resetVideoAvailabilityTrackingProbeForTests,
  wasAvailabilityMigrationWarningLogged,
} from "@/lib/video/videoAvailabilityRepository";

describe("videoAvailabilityRepository migration warning", () => {
  beforeEach(() => {
    resetVideoAvailabilityTrackingProbeForTests();
    vi.restoreAllMocks();
  });

  it("warns once per process when migration 009 columns are missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.mocked(createSupabaseServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            error: { code: "42703", message: "column availability_status does not exist" },
          }),
        }),
      }),
    } as never);

    expect(await isVideoAvailabilityTrackingEnabled()).toBe(false);
    expect(await isVideoAvailabilityTrackingEnabled()).toBe(false);
    expect(wasAvailabilityMigrationWarningLogged()).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("availability tracking is disabled");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("009_video_availability.sql");
    expect(warnSpy.mock.calls[0]?.[0]).toContain("measurement continues");
  });
});
