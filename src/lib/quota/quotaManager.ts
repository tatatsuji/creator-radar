import {
  QUOTA_MANAGER_CONFIG,
  QUOTA_OPERATION_PRIORITY,
  QUOTA_OPERATION_RESERVE_POOL,
  generalDailyBudgetUnits,
  type QuotaOperationType,
  type QuotaReservePool,
} from "@/lib/quota/quotaManagerConfig";
import { computeDynamicQuotaAvailability } from "@/lib/quota/quotaManagerLogic";
import { loadQuotaUsageTotals } from "@/lib/quota/quotaUsageLedger";

export type QuotaDecision = "allow" | "defer";

export interface QuotaBudgetWindow {
  timezone: string;
  dayKey: string;
  hourOfDay: number;
  hourStartedAt: string;
  hourEndsAt: string;
  dayStartedAt: string;
  dayEndsAt: string;
}

export interface QuotaBudgetSnapshot {
  window: QuotaBudgetWindow;
  dailyBudgetUnits: number;
  /** Reference equal-split hourly budget (daily / 24). */
  hourlyBudgetUnits: number;
  generalDailyBudgetUnits: number;
  /** Reference equal-split general hourly budget. */
  generalHourlyBudgetUnits: number;
  /** Dynamic allowance from daily remaining / hours left in day. */
  dynamicDailyHourlyAllowance: number;
  /** Dynamic allowance from general daily remaining / hours left in day. */
  dynamicGeneralHourlyAllowance: number;
  reserveBudgetUnits: Record<QuotaReservePool, number>;
  dailySpentUnits: number;
  hourlySpentUnits: number;
  dailyRemainingUnits: number;
  /** @deprecated Use dynamicDailyHourlyAllowance; kept for logging compatibility. */
  hourlyRemainingUnits: number;
  generalDailyRemainingUnits: number;
  /** @deprecated Use dynamicGeneralHourlyAllowance; kept for logging compatibility. */
  generalHourlyRemainingUnits: number;
  reserveSpentUnits: Record<QuotaReservePool, number>;
  reserveRemainingUnits: Record<QuotaReservePool, number>;
  hoursRemainingInDay: number;
  hoursRemainingFractional: number;
  msUntilDayEnd: number;
  msUntilNextHour: number;
}

export interface QuotaAuthorizationRequest {
  operationType: QuotaOperationType;
  estimatedUnits: number;
  now?: Date;
}

export interface QuotaAuthorizationResult {
  decision: QuotaDecision;
  reason: string;
  operationType: QuotaOperationType;
  estimatedUnits: number;
  priority: number;
  budget: QuotaBudgetSnapshot;
  availableUnits: number;
  retryAfter?: string;
  projectedRunsUntilDayEnd?: number;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return tzDate.getTime() - utcDate.getTime();
}

function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number },
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    0,
    0,
    0,
  );
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

function getZonedParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
  };
}

export function resolveQuotaBudgetWindow(
  now: Date = new Date(),
  timezone: string = QUOTA_MANAGER_CONFIG.timezone,
) {
  const { year, month, day, hour } = getZonedParts(now, timezone);
  const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const hourStartedAt = zonedTimeToUtc({ year, month, day, hour }, timezone);
  const hourEndsAt = new Date(hourStartedAt.getTime() + 60 * 60 * 1000);
  const dayStartedAt = zonedTimeToUtc({ year, month, day, hour: 0 }, timezone);
  const dayEndsAt = new Date(dayStartedAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    timezone,
    dayKey,
    hourOfDay: hour,
    hourStartedAt: hourStartedAt.toISOString(),
    hourEndsAt: hourEndsAt.toISOString(),
    dayStartedAt: dayStartedAt.toISOString(),
    dayEndsAt: dayEndsAt.toISOString(),
  };
}

export function buildQuotaBudgetSnapshot(input: {
  dailySpentUnits: number;
  hourlySpentUnits: number;
  reserveSpentUnits: Record<QuotaReservePool, number>;
  generalSpentUnits: number;
  now?: Date;
  config?: typeof QUOTA_MANAGER_CONFIG;
}): QuotaBudgetSnapshot {
  const config = input.config ?? QUOTA_MANAGER_CONFIG;
  const now = input.now ?? new Date();
  const window = resolveQuotaBudgetWindow(now, config.timezone);
  const dailyBudgetUnits = config.dailyBudgetUnits;
  const hourlyBudgetUnits = dailyBudgetUnits / config.hoursPerDay;
  const generalDaily = generalDailyBudgetUnits(config);
  const generalHourly = generalDaily / config.hoursPerDay;

  const dailyRemainingUnits = Math.max(0, dailyBudgetUnits - input.dailySpentUnits);
  const generalDailyRemainingUnits = Math.max(
    0,
    generalDaily - input.generalSpentUnits,
  );
  const msUntilDayEnd = Math.max(
    0,
    new Date(window.dayEndsAt).getTime() - now.getTime(),
  );
  const hoursRemainingFractional = Math.max(
    msUntilDayEnd / (60 * 60 * 1000),
    1 / 60,
  );
  const dynamicDailyHourlyAllowance =
    dailyRemainingUnits / hoursRemainingFractional;
  const dynamicGeneralHourlyAllowance =
    generalDailyRemainingUnits / hoursRemainingFractional;

  const hourlyRemainingUnits = Math.max(0, hourlyBudgetUnits - input.hourlySpentUnits);
  const generalHourlySpent = Math.max(
    0,
    input.hourlySpentUnits -
      Object.values(input.reserveSpentUnits).reduce((sum, value) => sum + value, 0),
  );
  const generalHourlyRemainingUnits = Math.max(0, generalHourly - generalHourlySpent);

  const reserveRemainingUnits = {
    measurementCritical: Math.max(
      0,
      config.reserveBudgetUnits.measurementCritical -
        input.reserveSpentUnits.measurementCritical,
    ),
    watchlist: Math.max(
      0,
      config.reserveBudgetUnits.watchlist - input.reserveSpentUnits.watchlist,
    ),
    emergencyDiscovery: Math.max(
      0,
      config.reserveBudgetUnits.emergencyDiscovery -
        input.reserveSpentUnits.emergencyDiscovery,
    ),
  };

  return {
    window,
    dailyBudgetUnits,
    hourlyBudgetUnits,
    generalDailyBudgetUnits: generalDaily,
    generalHourlyBudgetUnits: generalHourly,
    dynamicDailyHourlyAllowance,
    dynamicGeneralHourlyAllowance,
    reserveBudgetUnits: { ...config.reserveBudgetUnits },
    dailySpentUnits: input.dailySpentUnits,
    hourlySpentUnits: input.hourlySpentUnits,
    dailyRemainingUnits,
    hourlyRemainingUnits,
    generalDailyRemainingUnits,
    generalHourlyRemainingUnits,
    reserveSpentUnits: { ...input.reserveSpentUnits },
    reserveRemainingUnits,
    hoursRemainingInDay: Math.max(0, config.hoursPerDay - window.hourOfDay - 1),
    hoursRemainingFractional,
    msUntilDayEnd,
    msUntilNextHour: Math.max(0, new Date(window.hourEndsAt).getTime() - now.getTime()),
  };
}

function estimateRunsUntilDayEnd(
  operationType: QuotaOperationType,
  budget: QuotaBudgetSnapshot,
  config: typeof QUOTA_MANAGER_CONFIG = QUOTA_MANAGER_CONFIG,
): number {
  const intervalByOperation: Partial<Record<QuotaOperationType, number>> = {
    measurement_run: config.cronIntervalsMs.measurement,
    watchlist_discovery: config.cronIntervalsMs.watchlistDiscovery,
    candidate_discovery: config.cronIntervalsMs.candidateDiscovery,
    auto_watchlist: config.cronIntervalsMs.autoWatchlist,
  };
  const intervalMs = intervalByOperation[operationType];

  if (!intervalMs) {
    return budget.hoursRemainingInDay + 1;
  }

  const msRemaining = new Date(budget.window.dayEndsAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(msRemaining / intervalMs));
}

function computeAvailableUnits(input: {
  operationType: QuotaOperationType;
  budget: QuotaBudgetSnapshot;
}): number {
  if (input.operationType === "auto_watchlist") {
    return Number.POSITIVE_INFINITY;
  }

  const reservePool = QUOTA_OPERATION_RESERVE_POOL[input.operationType];

  return computeDynamicQuotaAvailability({
    dailyRemainingUnits: input.budget.dailyRemainingUnits,
    generalDailyRemainingUnits: input.budget.generalDailyRemainingUnits,
    reserveRemainingUnits: reservePool
      ? input.budget.reserveRemainingUnits[reservePool]
      : null,
    msUntilDayEnd: input.budget.msUntilDayEnd,
  });
}

export async function authorizeQuotaConsumption(
  request: QuotaAuthorizationRequest,
): Promise<QuotaAuthorizationResult> {
  const now = request.now ?? new Date();
  const config = QUOTA_MANAGER_CONFIG;
  const window = resolveQuotaBudgetWindow(now, config.timezone);
  const usage = await loadQuotaUsageTotals({
    dayStartedAt: window.dayStartedAt,
    hourStartedAt: window.hourStartedAt,
  });
  const budget = buildQuotaBudgetSnapshot({
    ...usage,
    now,
    config,
  });

  const priority = QUOTA_OPERATION_PRIORITY[request.operationType];
  const availableUnits = computeAvailableUnits({
    operationType: request.operationType,
    budget,
  });
  const projectedRunsUntilDayEnd = estimateRunsUntilDayEnd(
    request.operationType,
    budget,
    config,
  );

  if (request.operationType === "auto_watchlist" || request.estimatedUnits <= 0) {
    return {
      decision: "allow",
      reason: "zero_quota_operation",
      operationType: request.operationType,
      estimatedUnits: request.estimatedUnits,
      priority,
      budget,
      availableUnits,
      projectedRunsUntilDayEnd,
    };
  }

  const requiredUnits = request.estimatedUnits;

  if (availableUnits >= requiredUnits) {
    return {
      decision: "allow",
      reason: QUOTA_OPERATION_RESERVE_POOL[request.operationType]
        ? `reserve_available:${QUOTA_OPERATION_RESERVE_POOL[request.operationType]}`
        : "dynamic_budget_available",
      operationType: request.operationType,
      estimatedUnits: requiredUnits,
      priority,
      budget,
      availableUnits,
      projectedRunsUntilDayEnd,
    };
  }

  const retryAfter = new Date(
    now.getTime() + Math.max(config.deferRetryMs, budget.msUntilNextHour),
  ).toISOString();

  return {
    decision: "defer",
    reason: "insufficient_dynamic_budget",
    operationType: request.operationType,
    estimatedUnits: requiredUnits,
    priority,
    budget,
    availableUnits,
    retryAfter,
    projectedRunsUntilDayEnd,
  };
}

export function logQuotaAuthorization(result: QuotaAuthorizationResult): void {
  console.info(
    `[QuotaManager:AUTH] ${JSON.stringify({
      decision: result.decision,
      operationType: result.operationType,
      estimatedUnits: result.estimatedUnits,
      availableUnits: result.availableUnits,
      reason: result.reason,
      retryAfter: result.retryAfter ?? null,
      dayKey: result.budget.window.dayKey,
      hourOfDay: result.budget.window.hourOfDay,
      dailyRemainingUnits: result.budget.dailyRemainingUnits,
      dynamicDailyHourlyAllowance: result.budget.dynamicDailyHourlyAllowance,
      dynamicGeneralHourlyAllowance: result.budget.dynamicGeneralHourlyAllowance,
      hoursRemainingFractional: result.budget.hoursRemainingFractional,
      timestamp: new Date().toISOString(),
    })}`,
  );
}
