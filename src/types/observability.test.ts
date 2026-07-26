import { describe, expect, it } from "vitest";

import {
  CHANNEL_TYPES,
  DB_CHECK_CONSTRAINT_VALUES,
  DEFAULT_TIER_SYNC_MODE,
  DISCOVERY_ALGORITHM_VERSION,
  DISCOVERY_RUN_STATUSES,
  DISCOVERY_RUN_TYPES,
  DISCOVERY_SOURCE_TYPES,
  FUTURE_DB_CHECK_CONSTRAINT_VALUES,
  GENRE_IDS,
  MEASUREMENT_STATUSES,
  MEASUREMENT_TIERS,
  PROMOTION_ALGORITHM_VERSION,
  PROMOTION_REASONS,
  PROMOTION_STATES,
  RANKING_MVP_GENRES,
  RANKING_MVP_PERIODS,
  RANKING_PERIODS,
  SCORE_VERSION,
  SCORE_VERSION_V2,
  SCORE_VERSIONS,
  TIER_SYNC_MODES,
  WATCH_STATUSES,
  WATCH_TIERS,
  isChannelType,
  isDiscoveryAlgorithmVersion,
  isDiscoveryRunStatus,
  isDiscoveryRunType,
  isDiscoverySourceType,
  isGenreId,
  isMeasurementStatus,
  isMeasurementTier,
  isPromotionAlgorithmVersion,
  isPromotionReason,
  isPromotionState,
  isRankingMvpGenre,
  isRankingMvpPeriod,
  isRankingPeriod,
  isScoreVersion,
  isTierSyncMode,
  isWatchStatus,
  isWatchTier,
} from "@/types/observability";

describe("observability type guards", () => {
  it("accepts valid watch tier values", () => {
    for (const tier of WATCH_TIERS) {
      expect(isWatchTier(tier)).toBe(true);
    }
  });

  it("rejects invalid watch tier values", () => {
    expect(isWatchTier("invalid")).toBe(false);
    expect(isWatchTier("")).toBe(false);
  });

  it("accepts valid watch status values", () => {
    for (const status of WATCH_STATUSES) {
      expect(isWatchStatus(status)).toBe(true);
    }
  });

  it("rejects invalid watch status values", () => {
    expect(isWatchStatus("running")).toBe(false);
  });

  it("accepts valid measurement values", () => {
    for (const tier of MEASUREMENT_TIERS) {
      expect(isMeasurementTier(tier)).toBe(true);
    }
    for (const status of MEASUREMENT_STATUSES) {
      expect(isMeasurementStatus(status)).toBe(true);
    }
  });

  it("accepts valid discovery and ranking values", () => {
    for (const source of DISCOVERY_SOURCE_TYPES) {
      expect(isDiscoverySourceType(source)).toBe(true);
    }
    for (const status of DISCOVERY_RUN_STATUSES) {
      expect(isDiscoveryRunStatus(status)).toBe(true);
    }
    for (const runType of DISCOVERY_RUN_TYPES) {
      expect(isDiscoveryRunType(runType)).toBe(true);
    }
    for (const period of RANKING_PERIODS) {
      expect(isRankingPeriod(period)).toBe(true);
    }
    for (const genre of GENRE_IDS) {
      expect(isGenreId(genre)).toBe(true);
    }
  });

  it("accepts reserved promotion reasons and states", () => {
    for (const reason of PROMOTION_REASONS) {
      expect(isPromotionReason(reason)).toBe(true);
    }
    for (const state of PROMOTION_STATES) {
      expect(isPromotionState(state)).toBe(true);
    }
    expect(isPromotionReason("unknown_reason")).toBe(false);
    expect(isPromotionState("UNKNOWN")).toBe(false);
  });

  it("accepts promotion algorithm and tier sync values", () => {
    expect(PROMOTION_ALGORITHM_VERSION).toBe("promotion-v1");
    expect(isPromotionAlgorithmVersion("promotion-v1")).toBe(true);
    expect(isPromotionAlgorithmVersion("promotion-v2")).toBe(false);
    expect(DEFAULT_TIER_SYNC_MODE).toBe("shadow");
    for (const mode of TIER_SYNC_MODES) {
      expect(isTierSyncMode(mode)).toBe(true);
    }
  });

  it("accepts discovery run types including promotion batch", () => {
    expect(DISCOVERY_RUN_TYPES).toContain("promotion_batch");
    expect(isDiscoveryRunType("promotion_batch")).toBe(true);
  });

  it("limits ranking MVP scope to 24h/all", () => {
    expect(RANKING_MVP_PERIODS).toEqual(["24h"]);
    expect(RANKING_MVP_GENRES).toEqual(["all"]);
    expect(isRankingMvpPeriod("24h")).toBe(true);
    expect(isRankingMvpPeriod("7d")).toBe(false);
    expect(isRankingMvpGenre("all")).toBe(true);
    expect(isRankingMvpGenre("music")).toBe(false);
  });

  it("accepts channel types", () => {
    for (const channelType of CHANNEL_TYPES) {
      expect(isChannelType(channelType)).toBe(true);
    }
    expect(isChannelType("invalid")).toBe(false);
  });

  it("uses radar-v1 as the default score version and radar-v2 as phase 3 score", () => {
    expect(SCORE_VERSION).toBe("radar-v1");
    expect(SCORE_VERSION_V2).toBe("radar-v2");
    expect(SCORE_VERSIONS).toEqual(["radar-v1", "radar-v2"]);
    expect(isScoreVersion("radar-v1")).toBe(true);
    expect(isScoreVersion("radar-v2")).toBe(true);
    expect(isScoreVersion("radar-v3")).toBe(false);
  });

  it("uses discovery-v1 as the default algorithm version", () => {
    expect(DISCOVERY_ALGORITHM_VERSION).toBe("discovery-v1");
    expect(isDiscoveryAlgorithmVersion("discovery-v1")).toBe(true);
    expect(isDiscoveryAlgorithmVersion("discovery-v2")).toBe(false);
  });

  it("keeps DB check helper values aligned with constants", () => {
    expect(DB_CHECK_CONSTRAINT_VALUES.watch_tier).toEqual(WATCH_TIERS);
    expect(DB_CHECK_CONSTRAINT_VALUES.watch_status).toEqual(WATCH_STATUSES);
    expect(DB_CHECK_CONSTRAINT_VALUES.measurement_tier).toEqual(MEASUREMENT_TIERS);
    expect(DB_CHECK_CONSTRAINT_VALUES.measurement_status).toEqual(
      MEASUREMENT_STATUSES,
    );
    expect(DB_CHECK_CONSTRAINT_VALUES.discovery_run_status).toEqual(
      DISCOVERY_RUN_STATUSES,
    );
    expect(DB_CHECK_CONSTRAINT_VALUES.ranking_period).toEqual(RANKING_PERIODS);
    expect(DB_CHECK_CONSTRAINT_VALUES.genre).toEqual(GENRE_IDS);
    expect(DB_CHECK_CONSTRAINT_VALUES.score_version_default).toBe("radar-v1");
    expect(DB_CHECK_CONSTRAINT_VALUES.discovery_algorithm_version_default).toBe(
      "discovery-v1",
    );
    expect(FUTURE_DB_CHECK_CONSTRAINT_VALUES.promotion_state).toEqual(
      PROMOTION_STATES,
    );
  });
});
