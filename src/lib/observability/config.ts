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

  autoWatchlist: {
    /** Daily Auto Watchlist tier evaluation (promote/demote/restore). */
    cronIntervalMs: 24 * 60 * 60 * 1000,
  },

  watchlistDiscovery: {
    /** GHA watchlist cron interval — hourly; only due channels are polled per run. */
    cronIntervalMs: 60 * 60 * 1000,
  },

  phase1Discovery: {
    /** Primary Phase1 success metric: Discovery Recall (see docs/discovery-recall.md). */
    primaryMetric: "discovery_recall" as const,
    /** Candidate Engine cron interval — drives category rotation run index (6h). */
    discoveryRunIntervalMs: 6 * 60 * 60 * 1000,
    categoryGenres: [
      "entertainment",
      "music",
      "game",
      "news",
      "howto",
      "sports",
    ] as const satisfies readonly GenreId[],
    /** Tiered category fetch strategy — see src/lib/discovery/categoryStrategy.ts */
    categoryStrategy: {
      everyRun: ["entertainment", "music", "game"] as const satisfies readonly GenreId[],
      daily: ["news"] as const satisfies readonly GenreId[],
      rotation: ["howto", "sports"] as const satisfies readonly GenreId[],
      searchOnly: ["education"] as const satisfies readonly GenreId[],
      runsPerDay: 4,
    },
    genresPerRun: 3,
    maxResultsPerCategorySource: 25,
    mostPopularAllMaxResults: 50,
    mostPopularCategoryMaxResults: 25,
    mostPopularRegisterLimit: 130,
    shortsMaxResults: 25,
    liveMaxResults: 25,
    dbRemeasureLimit: 50,
    maxCandidatesPerRun: 250,
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
   * Cron schedules (GitHub Actions primary for watchlist + candidate + measurement).
   * Each schedule triggers a separate workflow run with github.event.schedule set.
   */
  cronSchedules: {
    legacySnapshot: "0 0 * * *",
    vercelDiscovery: "disabled",
    vercelMeasurement: "0 2 * * *",
    githubActionsMeasurement: "15 * * * *",
    githubActionsWatchlistDiscovery: "0 * * * *",
    githubActionsCandidateDiscovery: "0 */6 * * *",
    githubActionsAutoWatchlist: "30 3 * * *",
    githubActionsWebsubSubscribeNew: "0 2 * * *",
    githubActionsWebsubRenewUrgent: "0 */6 * * *",
    githubActionsWebsubRenewDaily: "0 3 * * *",
    githubActionsWebsubReconcile: "0 4 * * *",
    githubActionsWebsubProcessNotifications: "*/15 * * * *",
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
