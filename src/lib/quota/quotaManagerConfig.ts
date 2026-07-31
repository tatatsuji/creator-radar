import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** YouTube Data API daily quota budget (units). */
export const QUOTA_MANAGER_DAILY_BUDGET_UNITS = readPositiveInt(
  process.env.QUOTA_MANAGER_DAILY_BUDGET_UNITS,
  10_000,
);

/** IANA timezone used for daily/hourly budget windows (YouTube resets at Pacific midnight). */
export const QUOTA_MANAGER_TIMEZONE =
  process.env.QUOTA_MANAGER_TIMEZONE ?? "America/Los_Angeles";

/** Reserve pools that normal operations must not consume. */
export const QUOTA_MANAGER_RESERVE_BUDGET_UNITS = {
  measurementCritical: readPositiveInt(
    process.env.QUOTA_MANAGER_RESERVE_MEASUREMENT_CRITICAL_UNITS,
    1_200,
  ),
  watchlist: readPositiveInt(
    process.env.QUOTA_MANAGER_RESERVE_WATCHLIST_UNITS,
    1_800,
  ),
  emergencyDiscovery: readPositiveInt(
    process.env.QUOTA_MANAGER_RESERVE_EMERGENCY_DISCOVERY_UNITS,
    500,
  ),
} as const;

export type QuotaReservePool = keyof typeof QUOTA_MANAGER_RESERVE_BUDGET_UNITS;

export const QUOTA_OPERATION_TYPES = [
  "measurement_critical",
  "measurement_high",
  "measurement_normal",
  "measurement_low",
  "measurement_archive",
  "measurement_run",
  "watchlist_discovery",
  "candidate_discovery",
  "emergency_discovery",
  "auto_watchlist",
] as const;

export type QuotaOperationType = (typeof QUOTA_OPERATION_TYPES)[number];

/** Higher value = higher priority when competing for general budget. */
export const QUOTA_OPERATION_PRIORITY: Record<QuotaOperationType, number> = {
  measurement_critical: 100,
  emergency_discovery: 95,
  watchlist_discovery: 90,
  measurement_high: 85,
  measurement_run: 80,
  candidate_discovery: 60,
  measurement_normal: 50,
  measurement_low: 30,
  measurement_archive: 20,
  auto_watchlist: 10,
};

/** Reserve pool used by each operation. `null` draws from the general pool only. */
export const QUOTA_OPERATION_RESERVE_POOL: Record<
  QuotaOperationType,
  QuotaReservePool | null
> = {
  measurement_critical: "measurementCritical",
  measurement_high: "measurementCritical",
  measurement_normal: null,
  measurement_low: null,
  measurement_archive: null,
  measurement_run: null,
  watchlist_discovery: "watchlist",
  candidate_discovery: null,
  emergency_discovery: "emergencyDiscovery",
  auto_watchlist: null,
};

export const QUOTA_MANAGER_DEFER_RETRY_MS = readPositiveInt(
  process.env.QUOTA_MANAGER_DEFER_RETRY_MS,
  15 * 60 * 1000,
);

export const QUOTA_MANAGER_MAX_DEFER_ATTEMPTS = readPositiveInt(
  process.env.QUOTA_MANAGER_MAX_DEFER_ATTEMPTS,
  48,
);

/** Days to retain completed/cancelled deferred rows before cleanup (cron not included). */
export const QUOTA_MANAGER_DEFERRED_TERMINAL_TTL_DAYS = readPositiveInt(
  process.env.QUOTA_MANAGER_DEFERRED_TERMINAL_TTL_DAYS,
  7,
);

export const QUOTA_MANAGER_CONFIG = {
  dailyBudgetUnits: QUOTA_MANAGER_DAILY_BUDGET_UNITS,
  timezone: QUOTA_MANAGER_TIMEZONE,
  reserveBudgetUnits: QUOTA_MANAGER_RESERVE_BUDGET_UNITS,
  operationPriority: QUOTA_OPERATION_PRIORITY,
  operationReservePool: QUOTA_OPERATION_RESERVE_POOL,
  deferRetryMs: QUOTA_MANAGER_DEFER_RETRY_MS,
  maxDeferAttempts: QUOTA_MANAGER_MAX_DEFER_ATTEMPTS,
  deferredTerminalTtlDays: QUOTA_MANAGER_DEFERRED_TERMINAL_TTL_DAYS,
  hoursPerDay: 24,
  cronIntervalsMs: {
    measurement: 60 * 60 * 1000,
    watchlistDiscovery: OBSERVABILITY_CONFIG.watchlistDiscovery.cronIntervalMs,
    candidateDiscovery: OBSERVABILITY_CONFIG.phase1Discovery.discoveryRunIntervalMs,
    autoWatchlist: OBSERVABILITY_CONFIG.autoWatchlist.cronIntervalMs,
  },
} as const;

export function isQuotaOperationType(value: string): value is QuotaOperationType {
  return QUOTA_OPERATION_TYPES.includes(value as QuotaOperationType);
}

export function totalReserveBudgetUnits(
  config: typeof QUOTA_MANAGER_CONFIG = QUOTA_MANAGER_CONFIG,
): number {
  return (
    config.reserveBudgetUnits.measurementCritical +
    config.reserveBudgetUnits.watchlist +
    config.reserveBudgetUnits.emergencyDiscovery
  );
}

export function generalDailyBudgetUnits(
  config: typeof QUOTA_MANAGER_CONFIG = QUOTA_MANAGER_CONFIG,
): number {
  return Math.max(0, config.dailyBudgetUnits - totalReserveBudgetUnits(config));
}
