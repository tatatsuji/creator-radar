import { describe, expect, it } from "vitest";

import {
  MEASUREMENT_INTERVAL_MS,
  computeFailureBackoffNextAt,
  computeNextMeasurementAtAfterSuccess,
  shouldMarkMeasurementFailed,
} from "@/lib/observability/measurementScheduling";

describe("measurement scheduling", () => {
  const base = new Date("2026-07-24T12:00:00.000Z");

  it("computes tier intervals", () => {
    expect(
      computeNextMeasurementAtAfterSuccess("hot", base).toISOString(),
    ).toBe("2026-07-24T13:00:00.000Z");
    expect(
      computeNextMeasurementAtAfterSuccess("active", base).toISOString(),
    ).toBe("2026-07-24T15:00:00.000Z");
    expect(
      computeNextMeasurementAtAfterSuccess("normal", base).toISOString(),
    ).toBe("2026-07-25T00:00:00.000Z");
    expect(
      computeNextMeasurementAtAfterSuccess("cold", base).toISOString(),
    ).toBe("2026-07-25T12:00:00.000Z");
  });

  it("computes failure backoff from fixed time", () => {
    expect(
      computeFailureBackoffNextAt(base, 1).toISOString(),
    ).toBe("2026-07-24T12:15:00.000Z");
    expect(
      computeFailureBackoffNextAt(base, 2).toISOString(),
    ).toBe("2026-07-24T12:30:00.000Z");
  });

  it("marks failed after threshold", () => {
    expect(shouldMarkMeasurementFailed(2)).toBe(false);
    expect(shouldMarkMeasurementFailed(3)).toBe(true);
  });

  it("keeps config intervals centralized", () => {
    expect(MEASUREMENT_INTERVAL_MS.hot).toBe(60 * 60 * 1000);
  });
});
