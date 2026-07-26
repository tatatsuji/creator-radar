import {
  DEFAULT_TIER_SYNC_MODE,
  PROMOTION_ALGORITHM_VERSION,
  RANKING_MVP_GENRES,
  RANKING_MVP_PERIODS,
  SCORE_VERSION_V2,
  type MeasurementTier,
  type PromotionState,
  type TierSyncMode,
} from "@/types/observability";

export const PROMOTION_CONFIG = {
  algorithmVersion: PROMOTION_ALGORITHM_VERSION,
  tierSyncMode: DEFAULT_TIER_SYNC_MODE satisfies TierSyncMode,
  scoreVersion: SCORE_VERSION_V2,

  rankingMvp: {
    periods: RANKING_MVP_PERIODS,
    genres: RANKING_MVP_GENRES,
    futureEnablement: {
      period3dMinActiveVideos: 500,
      period7d30dMinActiveVideos: 2_000,
      genreRankingMinBaselineSampleCount: 100,
    },
  },

  thresholds: {
    risingSelfMultiplier: 2,
    risingMinAcceleration: 0,
    hotGenreP90Multiplier: 1,
    hotMaxViewCount: 100_000,
    trendingGenreMedianMultiplier: 1.5,
    decliningVelocityRatio: 0.5,
    hysteresisRuns: 2,
    minGenreBaselineSampleCount: 30,
    earlyDiscoveryBoostHours: 72,
  },

  recommendedTierByState: {
    HOT: "hot",
    RISING: "active",
    TRENDING: "active",
    STABLE: "normal",
    DECLINING: "cold",
  } satisfies Record<PromotionState, MeasurementTier>,

  scoreV2: {
    scale: 300,
    weights: {
      velocity: 45,
      viewsPerSubscriber: 22,
      genreZScore: 12,
      earlyDiscovery: 20,
      absoluteSizePenalty: 18,
    },
    qualityMultipliers: {
      measured: 1,
      estimated: 0.5,
      unavailable: 0,
    },
    promotionMultipliers: {
      HOT: 1.2,
      RISING: 1.2,
      TRENDING: 1,
      STABLE: 1,
      DECLINING: 0.3,
    },
    maxViewsPerSubscriberForScore: 30,
  },
} as const;
