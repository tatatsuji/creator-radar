import { describe, expect, it, vi } from "vitest";

import {
  buildQuotaBudgetSnapshot,
  authorizeQuotaConsumption,
} from "@/lib/quota/quotaManager";
import {
  QUOTA_MANAGER_CONFIG,
  generalDailyBudgetUnits,
} from "@/lib/quota/quotaManagerConfig";
import {
  estimateMeasurementRunQuotaUnits,
  estimateWatchlistDiscoveryQuotaUnits,
} from "@/lib/quota/quotaOperationEstimates";

vi.mock("@/lib/quota/quotaUsageLedger", () => ({
  loadQuotaUsageTotals: vi.fn().mockResolvedValue({
    dailySpentUnits: 0,
    hourlySpentUnits: 0,
    reserveSpentUnits: {
      measurementCritical: 0,
      watchlist: 0,
      emergencyDiscovery: 0,
    },
    generalSpentUnits: 0,
  }),
}));

describe("quota manager dynamic budget integration", () => {
  it("computes dynamic allowance from daily remaining and hours left", () => {
    const snapshot = buildQuotaBudgetSnapshot({
      dailySpentUnits: 0,
      hourlySpentUnits: 0,
      reserveSpentUnits: {
        measurementCritical: 0,
        watchlist: 0,
        emergencyDiscovery: 0,
      },
      generalSpentUnits: 0,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(snapshot.dynamicGeneralHourlyAllowance).toBeGreaterThan(
      snapshot.generalHourlyBudgetUnits,
    );
    expect(snapshot.generalDailyBudgetUnits).toBe(generalDailyBudgetUnits());
    expect(snapshot.dailyRemainingUnits).toBe(
      QUOTA_MANAGER_CONFIG.dailyBudgetUnits,
    );
  });

  it("carries unused quota by increasing allowance later in the day", () => {
    const startOfDay = buildQuotaBudgetSnapshot({
      dailySpentUnits: 0,
      hourlySpentUnits: 0,
      reserveSpentUnits: {
        measurementCritical: 0,
        watchlist: 0,
        emergencyDiscovery: 0,
      },
      generalSpentUnits: 0,
      now: new Date("2026-07-31T07:00:00.000Z"),
    });
    const nearDayEnd = buildQuotaBudgetSnapshot({
      dailySpentUnits: 0,
      hourlySpentUnits: 0,
      reserveSpentUnits: {
        measurementCritical: 0,
        watchlist: 0,
        emergencyDiscovery: 0,
      },
      generalSpentUnits: 0,
      now: new Date("2026-07-31T23:00:00.000Z"),
    });

    expect(nearDayEnd.dynamicGeneralHourlyAllowance).toBeGreaterThan(
      startOfDay.dynamicGeneralHourlyAllowance,
    );
  });

  it("defers when request exceeds dynamic allowance", async () => {
    const snapshot = buildQuotaBudgetSnapshot({
      dailySpentUnits: 0,
      hourlySpentUnits: 0,
      reserveSpentUnits: {
        measurementCritical: 0,
        watchlist: 0,
        emergencyDiscovery: 0,
      },
      generalSpentUnits: 0,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });

    const result = await authorizeQuotaConsumption({
      operationType: "candidate_discovery",
      estimatedUnits: snapshot.dynamicGeneralHourlyAllowance + 1,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(result.decision).toBe("defer");
    expect(result.reason).toBe("insufficient_dynamic_budget");
    expect(result.retryAfter).toBeDefined();
  });

  it("allows reserve-backed watchlist operations within reserve pool", async () => {
    const result = await authorizeQuotaConsumption({
      operationType: "watchlist_discovery",
      estimatedUnits: 60,
      now: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("reserve_available:watchlist");
  });

  it("allows zero-quota auto watchlist operations", async () => {
    const result = await authorizeQuotaConsumption({
      operationType: "auto_watchlist",
      estimatedUnits: 0,
    });

    expect(result.decision).toBe("allow");
    expect(result.reason).toBe("zero_quota_operation");
  });
});

describe("quota operation estimates", () => {
  it("estimates watchlist and measurement units from due counts", () => {
    expect(estimateWatchlistDiscoveryQuotaUnits(20)).toBe(60);
    expect(estimateMeasurementRunQuotaUnits(50)).toBe(1);
    expect(estimateMeasurementRunQuotaUnits(0)).toBe(0);
  });
});
