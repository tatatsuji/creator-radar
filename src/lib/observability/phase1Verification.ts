/**
 * Phase1 operational verification constants.
 * 6h discovery primary: GitHub Actions observability-cron.yml (Vercel discovery disabled).
 */
export const PHASE1_VERIFICATION = {
  /** ISO timestamp when GHA 6h discovery became primary (commit d2c13ac deploy). */
  sixHourCronStartIso: "2026-07-27T18:00:00.000Z",
  /** Minimum post-cron videos required for 24h speed verdict. */
  minSpeedSampleSize: 10,
  /** Extend speed verification window if sample too small. */
  extendedVerificationHours: 72,
  recallTargets: {
    overallRecall: 0.85,
    mainstreamBuzzRecall: 0.9,
    measurementConnectionRate: 0.95,
    dailyQuotaUsageRatio: 0.7,
  },
  speedTargets: {
    medianHours: 12,
    p90Hours: 48,
    within24hRate: 0.7,
    cronSuccessRate: 0.95,
  },
} as const;
