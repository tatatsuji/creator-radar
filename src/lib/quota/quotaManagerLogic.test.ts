import { describe, expect, it } from "vitest";

import {
  computeDeferredTerminalCleanupCutoff,
  computeDynamicHourlyAllowance,
  computeDynamicQuotaAvailability,
  isDeferredQuotaOperationExpired,
  resolveDeferredEnqueueUpsert,
  resolveDeferredRetryUpsert,
} from "@/lib/quota/quotaManagerLogic";
import { QUOTA_MANAGER_CONFIG } from "@/lib/quota/quotaManagerConfig";

describe("resolveDeferredEnqueueUpsert", () => {
  it("inserts when no pending operation exists", () => {
    expect(resolveDeferredEnqueueUpsert({ existingPending: null, estimatedUnits: 60 })).toEqual({
      action: "insert",
      nextAttemptCount: 1,
      maxAttempts: QUOTA_MANAGER_CONFIG.maxDeferAttempts,
    });
  });

  it("updates retry metadata and increments attempt for existing pending", () => {
    expect(
      resolveDeferredEnqueueUpsert({
        existingPending: { id: "a", attempt_count: 2, max_attempts: 48 },
        estimatedUnits: 60,
      }),
    ).toEqual({
      action: "update",
      nextAttemptCount: 3,
      maxAttempts: 48,
    });
  });

  it("cancels when max attempts would be exceeded", () => {
    expect(
      resolveDeferredEnqueueUpsert({
        existingPending: { id: "a", attempt_count: 47, max_attempts: 48 },
        estimatedUnits: 60,
      }),
    ).toEqual({
      action: "cancel",
      nextAttemptCount: 48,
      maxAttempts: 48,
    });
  });
});

describe("resolveDeferredRetryUpsert", () => {
  it("cancels when retry reschedule exceeds max attempts", () => {
    expect(
      resolveDeferredRetryUpsert({ attempt_count: 47, max_attempts: 48 }),
    ).toEqual({
      action: "cancel",
      nextAttemptCount: 48,
      maxAttempts: 48,
    });
  });
});

describe("deferred terminal TTL", () => {
  it("marks completed rows expired after configured TTL", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const updatedAt = "2026-07-30T12:00:00.000Z";

    expect(
      isDeferredQuotaOperationExpired({
        status: "completed",
        updatedAt,
        now,
        ttlDays: 7,
      }),
    ).toBe(true);
  });

  it("keeps completed rows within TTL", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const updatedAt = "2026-07-31T12:00:00.000Z";

    expect(
      isDeferredQuotaOperationExpired({
        status: "completed",
        updatedAt,
        now,
        ttlDays: 7,
      }),
    ).toBe(false);
  });

  it("computes cleanup cutoff timestamp", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    expect(computeDeferredTerminalCleanupCutoff(now, 7)).toBe(
      "2026-07-31T12:00:00.000Z",
    );
  });
});

describe("dynamic hour budget", () => {
  it("distributes remaining daily quota across hours left in day", () => {
    const allowance = computeDynamicHourlyAllowance({
      remainingUnits: 6500,
      msUntilDayEnd: 13 * 60 * 60 * 1000,
    });

    expect(allowance).toBe(500);
  });

  it("carries unused quota forward by increasing later-hour allowance", () => {
    const early = computeDynamicHourlyAllowance({
      remainingUnits: 6500,
      msUntilDayEnd: 24 * 60 * 60 * 1000,
    });
    const late = computeDynamicHourlyAllowance({
      remainingUnits: 6500,
      msUntilDayEnd: 6 * 60 * 60 * 1000,
    });

    expect(late).toBeGreaterThan(early);
  });

  it("allows reserve-backed operations up to reserve and dynamic daily caps", () => {
    const available = computeDynamicQuotaAvailability({
      dailyRemainingUnits: 9000,
      generalDailyRemainingUnits: 6500,
      reserveRemainingUnits: 1800,
      msUntilDayEnd: 10 * 60 * 60 * 1000,
    });

    expect(available).toBe(900);
  });

  it("uses general dynamic allowance for non-reserve operations", () => {
    const available = computeDynamicQuotaAvailability({
      dailyRemainingUnits: 9000,
      generalDailyRemainingUnits: 6500,
      reserveRemainingUnits: null,
      msUntilDayEnd: 10 * 60 * 60 * 1000,
    });

    expect(available).toBe(650);
  });

  it("handles boundary at day end", () => {
    const available = computeDynamicQuotaAvailability({
      dailyRemainingUnits: 100,
      generalDailyRemainingUnits: 100,
      reserveRemainingUnits: null,
      msUntilDayEnd: 30 * 1000,
    });

    expect(available).toBe(100);
  });
});
