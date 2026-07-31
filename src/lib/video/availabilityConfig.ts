function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPositiveHours(value: string | undefined, fallbackHours: number): number {
  return readPositiveInt(value, fallbackHours) * 60 * 60 * 1000;
}

export const VIDEO_AVAILABILITY_CONFIG = {
  /** Consecutive missing responses required before deletion confirmation. */
  confirmMissingCount: readPositiveInt(
    process.env.VIDEO_AVAILABILITY_CONFIRM_COUNT,
    3,
  ),
  /** Minimum elapsed time since first_unavailable_at before confirmation. */
  confirmMinElapsedMs: readPositiveHours(
    process.env.VIDEO_AVAILABILITY_CONFIRM_MIN_HOURS,
    6,
  ),
  /** Backoff between retries while unavailable_pending. */
  retryBackoffMs: readPositiveInt(
    process.env.VIDEO_AVAILABILITY_RETRY_BACKOFF_MINUTES,
    15,
  ) * 60 * 1000,
} as const;
