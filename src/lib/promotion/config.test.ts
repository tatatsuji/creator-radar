import { describe, expect, it } from "vitest";

import { PROMOTION_CONFIG } from "@/lib/promotion/config";
import {
  DEFAULT_TIER_SYNC_MODE,
  FUTURE_DB_CHECK_CONSTRAINT_VALUES,
  PROMOTION_ALGORITHM_VERSION,
  PROMOTION_STATES,
  RANKING_MVP_GENRES,
  RANKING_MVP_PERIODS,
  SCORE_VERSION_V2,
  TIER_SYNC_MODES,
} from "@/types/observability";

describe("promotion config", () => {
  it("defaults tier sync to shadow mode", () => {
    expect(PROMOTION_CONFIG.tierSyncMode).toBe(DEFAULT_TIER_SYNC_MODE);
    expect(PROMOTION_CONFIG.tierSyncMode).toBe("shadow");
  });

  it("limits ranking MVP to 24h/all", () => {
    expect(PROMOTION_CONFIG.rankingMvp.periods).toEqual(RANKING_MVP_PERIODS);
    expect(PROMOTION_CONFIG.rankingMvp.genres).toEqual(RANKING_MVP_GENRES);
    expect(PROMOTION_CONFIG.rankingMvp.periods).toEqual(["24h"]);
    expect(PROMOTION_CONFIG.rankingMvp.genres).toEqual(["all"]);
  });

  it("uses radar-v2 for promotion phase scoring", () => {
    expect(PROMOTION_CONFIG.scoreVersion).toBe(SCORE_VERSION_V2);
    expect(PROMOTION_CONFIG.algorithmVersion).toBe(PROMOTION_ALGORITHM_VERSION);
  });

  it("maps every promotion state to a recommended measurement tier", () => {
    for (const state of PROMOTION_STATES) {
      expect(PROMOTION_CONFIG.recommendedTierByState[state]).toBeDefined();
    }
  });

  it("requires hysteresis of at least two runs", () => {
    expect(PROMOTION_CONFIG.thresholds.hysteresisRuns).toBeGreaterThanOrEqual(2);
  });

  it("keeps future DB preview values aligned with constants", () => {
    expect(FUTURE_DB_CHECK_CONSTRAINT_VALUES.promotion_state).toEqual(
      PROMOTION_STATES,
    );
    expect(FUTURE_DB_CHECK_CONSTRAINT_VALUES.tier_sync_mode).toEqual(
      TIER_SYNC_MODES,
    );
    expect(FUTURE_DB_CHECK_CONSTRAINT_VALUES.score_version_v2).toBe(
      SCORE_VERSION_V2,
    );
  });
});
