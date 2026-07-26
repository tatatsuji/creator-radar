import { describe, expect, it } from "vitest";

import {
  buildDefaultQuotaScenarios,
  estimateQuotaScenario,
} from "@/lib/observability/quotaEstimates";

describe("quota estimates", () => {
  it("estimates current dev usage within daily quota", () => {
    const estimate = estimateQuotaScenario({
      label: "dev",
      watchlistChannels: 3,
      measuredVideos: 15,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
      legacySnapshotRunsPerDay: 24,
    });

    expect(estimate.discoveryUnitsPerDay).toBe(36);
    expect(estimate.measurementUnitsPerDay).toBe(24);
    expect(estimate.totalUnitsPerDay).toBeLessThanOrEqual(10_000);
    expect(estimate.withinDailyQuota).toBe(true);
  });

  it("builds scaling scenarios", () => {
    const scenarios = buildDefaultQuotaScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.some((scenario) => scenario.label.includes("10,000"))).toBe(
      true,
    );
  });
});
