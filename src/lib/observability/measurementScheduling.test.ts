import { describe, expect, it } from "vitest";

import {
  ADAPTIVE_MEASUREMENT_CONFIG,
  getAdaptiveMeasurementIntervalMs,
} from "@/lib/measurement/adaptiveMeasurementConfig";
import {
  MEASUREMENT_INTERVAL_MS,
  computeFailureBackoffNextAt,
  computeNextMeasurementAtAfterSuccess,
  shouldMarkMeasurementFailed,
} from "@/lib/observability/measurementScheduling";

describe("measurement scheduling", () => {
  const base = new Date("2026-07-24T12:00:00.000Z");

  it("computes adaptive tier intervals from config", () => {
    expect(
      computeNextMeasurementAtAfterSuccess("critical", base).toISOString(),
    ).toBe(
      new Date(
        base.getTime() + ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.critical,
      ).toISOString(),
    );
    expect(
      computeNextMeasurementAtAfterSuccess("high", base).toISOString(),
    ).toBe(
      new Date(
        base.getTime() + ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.high,
      ).toISOString(),
    );
    expect(
      computeNextMeasurementAtAfterSuccess("normal", base).toISOString(),
    ).toBe(
      new Date(
        base.getTime() + ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.normal,
      ).toISOString(),
    );
    expect(
      computeNextMeasurementAtAfterSuccess("low", base).toISOString(),
    ).toBe(
      new Date(
        base.getTime() + ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.low,
      ).toISOString(),
    );
    expect(
      computeNextMeasurementAtAfterSuccess("archive", base).toISOString(),
    ).toBe(
      new Date(
        base.getTime() + ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.archive,
      ).toISOString(),
    );
  });

  it("keeps legacy tier intervals for backward compatibility", () => {
    expect(
      computeNextMeasurementAtAfterSuccess("hot", base).toISOString(),
    ).toBe("2026-07-24T13:00:00.000Z");
    expect(
      computeNextMeasurementAtAfterSuccess("active", base).toISOString(),
    ).toBe("2026-07-24T15:00:00.000Z");
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

  it("routes adaptive tiers through config intervals", () => {
    expect(getAdaptiveMeasurementIntervalMs("critical")).toBe(
      ADAPTIVE_MEASUREMENT_CONFIG.intervalsMs.critical,
    );
    expect(MEASUREMENT_INTERVAL_MS.hot).toBe(60 * 60 * 1000);
  });
});
