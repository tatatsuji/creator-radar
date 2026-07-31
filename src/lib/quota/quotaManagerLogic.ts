import type { QuotaDeferredStatus } from "@/lib/quota/quotaDeferredQueue";
import { QUOTA_MANAGER_CONFIG } from "@/lib/quota/quotaManagerConfig";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DeferredEnqueueUpsertInput {
  existingPending: {
    id: string;
    attempt_count: number;
    max_attempts: number;
  } | null;
  estimatedUnits: number;
  maxAttempts?: number;
}

export interface DeferredEnqueueUpsertDecision {
  action: "insert" | "update" | "cancel";
  nextAttemptCount: number;
  maxAttempts: number;
}

export function resolveDeferredEnqueueUpsert(
  input: DeferredEnqueueUpsertInput,
): DeferredEnqueueUpsertDecision {
  const maxAttempts = input.maxAttempts ?? QUOTA_MANAGER_CONFIG.maxDeferAttempts;

  if (!input.existingPending) {
    return {
      action: "insert",
      nextAttemptCount: 1,
      maxAttempts,
    };
  }

  const nextAttemptCount = input.existingPending.attempt_count + 1;

  if (nextAttemptCount >= maxAttempts) {
    return {
      action: "cancel",
      nextAttemptCount,
      maxAttempts,
    };
  }

  return {
    action: "update",
    nextAttemptCount,
    maxAttempts,
  };
}

export function resolveDeferredRetryUpsert(input: {
  attempt_count: number;
  max_attempts: number;
}): DeferredEnqueueUpsertDecision {
  const nextAttemptCount = input.attempt_count + 1;

  if (nextAttemptCount >= input.max_attempts) {
    return {
      action: "cancel",
      nextAttemptCount,
      maxAttempts: input.max_attempts,
    };
  }

  return {
    action: "update",
    nextAttemptCount,
    maxAttempts: input.max_attempts,
  };
}

export function isDeferredTerminalStatus(
  status: QuotaDeferredStatus,
): status is "completed" | "cancelled" {
  return status === "completed" || status === "cancelled";
}

export function isDeferredQuotaOperationExpired(input: {
  status: QuotaDeferredStatus;
  updatedAt: string;
  now?: Date;
  ttlDays?: number;
}): boolean {
  if (!isDeferredTerminalStatus(input.status)) {
    return false;
  }

  const ttlDays = input.ttlDays ?? QUOTA_MANAGER_CONFIG.deferredTerminalTtlDays;
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - new Date(input.updatedAt).getTime();
  return ageMs >= ttlDays * MS_PER_DAY;
}

export function computeDeferredTerminalCleanupCutoff(
  now: Date = new Date(),
  ttlDays: number = QUOTA_MANAGER_CONFIG.deferredTerminalTtlDays,
): string {
  return new Date(now.getTime() - ttlDays * MS_PER_DAY).toISOString();
}

export function computeDynamicHourlyAllowance(input: {
  remainingUnits: number;
  msUntilDayEnd: number;
  minHours?: number;
}): number {
  const minHours = input.minHours ?? 1 / 60;
  const hoursRemaining = Math.max(input.msUntilDayEnd / (60 * 60 * 1000), minHours);
  return input.remainingUnits / hoursRemaining;
}

export function computeDynamicQuotaAvailability(input: {
  dailyRemainingUnits: number;
  generalDailyRemainingUnits: number;
  reserveRemainingUnits: number | null;
  msUntilDayEnd: number;
}): number {
  const dynamicDailyAllowance = computeDynamicHourlyAllowance({
    remainingUnits: input.dailyRemainingUnits,
    msUntilDayEnd: input.msUntilDayEnd,
  });

  if (input.reserveRemainingUnits !== null) {
    return Math.min(
      input.reserveRemainingUnits,
      input.dailyRemainingUnits,
      dynamicDailyAllowance,
    );
  }

  const dynamicGeneralAllowance = computeDynamicHourlyAllowance({
    remainingUnits: input.generalDailyRemainingUnits,
    msUntilDayEnd: input.msUntilDayEnd,
  });

  return Math.min(
    input.generalDailyRemainingUnits,
    dynamicGeneralAllowance,
    dynamicDailyAllowance,
  );
}
