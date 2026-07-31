function readPositiveHours(value: string | undefined, fallbackHours: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackHours;
  return hours * 60 * 60 * 1000;
}

export const WATCHLIST_FAILURE_BACKOFF_MS = {
  after1: readPositiveHours(process.env.WATCHLIST_FAILURE_BACKOFF_HOURS_1, 1),
  after2: readPositiveHours(process.env.WATCHLIST_FAILURE_BACKOFF_HOURS_2, 3),
  after3: readPositiveHours(process.env.WATCHLIST_FAILURE_BACKOFF_HOURS_3, 6),
  after4OrMore: readPositiveHours(process.env.WATCHLIST_FAILURE_BACKOFF_HOURS_4_PLUS, 24),
} as const;

export function computeWatchlistFailureBackoffMs(
  failureCount: number,
  config: typeof WATCHLIST_FAILURE_BACKOFF_MS = WATCHLIST_FAILURE_BACKOFF_MS,
): number {
  if (failureCount <= 0) {
    throw new Error("failureCount must be positive");
  }
  if (failureCount === 1) {
    return config.after1;
  }
  if (failureCount === 2) {
    return config.after2;
  }
  if (failureCount === 3) {
    return config.after3;
  }
  return config.after4OrMore;
}

export function computeWatchlistFailureNextCheckAt(
  from: Date,
  failureCount: number,
  config: typeof WATCHLIST_FAILURE_BACKOFF_MS = WATCHLIST_FAILURE_BACKOFF_MS,
): Date {
  return new Date(from.getTime() + computeWatchlistFailureBackoffMs(failureCount, config));
}
