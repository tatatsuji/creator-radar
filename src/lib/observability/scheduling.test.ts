import { describe, expect, it } from "vitest";

import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  computeDefaultNextCheckAt,
  computeDefaultNextMeasurementAt,
} from "@/lib/observability/scheduling";

describe("scheduling pure functions", () => {
  const base = new Date("2026-07-24T00:00:00.000Z");

  it("computes default next check time from a fixed base", () => {
    const next = computeDefaultNextCheckAt(base);
    expect(next.toISOString()).toBe("2026-07-24T06:00:00.000Z");
  });

  it("computes default next measurement time from a fixed base", () => {
    const next = computeDefaultNextMeasurementAt(base);
    expect(next.toISOString()).toBe("2026-07-24T01:00:00.000Z");
  });

  it("supports custom intervals", () => {
    const next = computeDefaultNextCheckAt(base, 30 * 60 * 1000);
    expect(next.toISOString()).toBe("2026-07-24T00:30:00.000Z");
  });

  it("rejects invalid intervals", () => {
    expect(() => computeDefaultNextCheckAt(base, 0)).toThrow(
      "intervalMs must be a positive number",
    );
  });

  it("uses configured default intervals", () => {
    expect(OBSERVABILITY_CONFIG.defaultNextCheckIntervalMs).toBe(
      6 * 60 * 60 * 1000,
    );
    expect(OBSERVABILITY_CONFIG.defaultNextMeasurementIntervalMs).toBe(
      60 * 60 * 1000,
    );
  });
});
