import {
  DISCOVERY_ALGORITHM_VERSION,
  SCORE_VERSION,
  type DiscoveryAlgorithmVersion,
  type DiscoveryRunStatus,
  type DiscoveryRunType,
  type DiscoverySourceType,
  type GenreId,
  type MeasurementStatus,
  type MeasurementTier,
  type RankingPeriod,
  type ScoreVersion,
  type WatchStatus,
  type WatchTier,
} from "@/types/observability";

/**
 * Observability pipeline configuration.
 *
 * updated_at policy (Phase 1):
 * - No DB triggers on channel_watchlist or measurement_schedule.
 * - Repository implementations must set updated_at on every write.
 * - Matches existing channels/videos pattern in snapshots/repository.ts.
 */
export const OBSERVABILITY_CONFIG = {
  scoreVersion: SCORE_VERSION satisfies ScoreVersion,
  discoveryAlgorithmVersion:
    DISCOVERY_ALGORITHM_VERSION satisfies DiscoveryAlgorithmVersion,
  rankingSource: "observability" as const,

  rankingDiscovery: {
    periods: ["24h", "7d"] as const satisfies readonly RankingPeriod[],
    searchCallsPerRun: 2,
  },

  defaultNextCheckIntervalMs: 6 * 60 * 60 * 1000,
  defaultNextMeasurementIntervalMs: 60 * 60 * 1000,
  lockTtlMs: 5 * 60 * 1000,
  measurementFailureThreshold: 3,
  measurementBackoffBaseMs: 15 * 60 * 1000,

  batchSize: {
    watchlistCheck: 20,
    measurement: 50,
    discovery: 30,
    rankingSnapshotInsert: 100,
  },

  repositoryLimits: {
    maxDueChannels: 20,
    maxDueVideos: 50,
    maxDiscoveryBatch: 30,
  },

  defaults: {
    watchTier: "normal" satisfies WatchTier,
    watchStatus: "seed" satisfies WatchStatus,
    measurementTier: "normal" satisfies MeasurementTier,
    measurementStatus: "pending" satisfies MeasurementStatus,
    discoveryRunStatus: "running" satisfies DiscoveryRunStatus,
    rankingPeriod: "24h" satisfies RankingPeriod,
    genre: "all" satisfies GenreId,
    discoveryRunType: "watchlist_check" satisfies DiscoveryRunType,
    discoverySourceType: "seed_channel" satisfies DiscoverySourceType,
  },

  /**
   * Vercel Cron schedules (vercel.json).
   * Measurement runs at :15 to reduce overlap with legacy snapshot (:00).
   */
  cronSchedules: {
    legacySnapshot: "0 0 * * *",
    discovery: "0 6 * * *",
    measurement: "0 12 * * *",
    githubActionsMeasurement: "15 * * * *",
    githubActionsDiscovery: "0 */6 * * *",
  },

  health: {
    discoveryHealthyWithinMs: 12 * 60 * 60 * 1000,
    measurementHealthyWithinMs: 2 * 60 * 60 * 1000,
    snapshotFreshnessWarningMs: 2 * 60 * 60 * 1000,
    discoveryRunningWindowMs: 10 * 60 * 1000,
    measurementRunningWindowMs: 10 * 60 * 1000,
  },
} as const;

export type RankingSource = typeof OBSERVABILITY_CONFIG.rankingSource;
