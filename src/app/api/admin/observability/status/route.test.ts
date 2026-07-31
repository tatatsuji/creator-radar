import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/observability/status/route";

vi.mock("@/lib/admin/auth", () => ({
  isAdminSecretConfigured: vi.fn(),
  verifyAdminSecret: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/observability/status", () => ({
  loadObservabilityStatus: vi.fn().mockResolvedValue({
    watchlistCount: 3,
    candidateCount: 15,
    discoveryDueCount: 1,
    channelsCheckedThisRun: 3,
    videosDiscoveredThisRun: 5,
    discoverySourceCounts: { watchlist_upload: 15 },
    lastDiscoveryRun: null,
    measurement: {
      scheduleTotal: 15,
      scheduleByTier: { hot: 15 },
      scheduleByStatus: { active: 15 },
      dueNow: 0,
      activeLocks: 0,
      latestLastMeasuredAt: "2026-07-25T21:30:00.000Z",
      videoSnapshotsCount: 115,
      snapshotsLast24Hours: 15,
      videosWithSnapshots: 15,
      videosWithMultipleSnapshots: 0,
      latestSnapshotCapturedAt: "2026-07-25T21:30:00.000Z",
      lastRun: null,
    },
    health: {
      discovery: "healthy",
      measurement: "healthy",
      snapshotFreshnessMinutes: 30,
      dueMeasurementCount: 0,
      activeLockCount: 0,
    },
    websub: null,
    checkedAt: "2026-07-26T06:00:00.000Z",
  }),
}));

describe("admin observability status", () => {
  it("returns a clear error when ADMIN_SECRET is missing", async () => {
    const { isAdminSecretConfigured } = await import("@/lib/admin/auth");
    vi.mocked(isAdminSecretConfigured).mockReturnValue(false);

    const response = await GET({
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("ADMIN_SECRET is not configured");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { isAdminSecretConfigured, verifyAdminSecret } = await import(
      "@/lib/admin/auth"
    );
    vi.mocked(isAdminSecretConfigured).mockReturnValue(true);
    vi.mocked(verifyAdminSecret).mockReturnValue(false);

    const response = await GET({
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(401);
  });

  it("returns 401 when ADMIN_SECRET is invalid", async () => {
    const { isAdminSecretConfigured, verifyAdminSecret } = await import(
      "@/lib/admin/auth"
    );
    vi.mocked(isAdminSecretConfigured).mockReturnValue(true);
    vi.mocked(verifyAdminSecret).mockReturnValue(false);

    const response = await GET({
      headers: new Headers({ authorization: "Bearer wrong-secret" }),
    } as never);

    expect(response.status).toBe(401);
  });

  it("returns observability payload when authorized", async () => {
    const { isAdminSecretConfigured, verifyAdminSecret } = await import(
      "@/lib/admin/auth"
    );
    vi.mocked(isAdminSecretConfigured).mockReturnValue(true);
    vi.mocked(verifyAdminSecret).mockReturnValue(true);

    const response = await GET({
      headers: new Headers({ authorization: "Bearer valid-secret" }),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.watchlistCount).toBe(3);
    expect(body.candidateCount).toBe(15);
    expect(body.discoveryDueCount).toBe(1);
    expect(body.measurement.scheduleTotal).toBe(15);
    expect(body.health.measurement).toBe("healthy");
  });
});
