import {
  HOME_UI_RANKING_TYPE_TABS,
  type RankingTypeTab,
} from "@/lib/ranking/rankingMeta";
import {
  isRankingType,
  normalizeHomeUiRanking,
  type HomeUiRankingType,
  type RankingType,
} from "@/types/ranking";

export type { RankingType, HomeUiRankingType };

/** Tabs rendered on the home page (buzz + early_rise only) */
export const RANKING_TYPE_TABS: RankingTypeTab[] = HOME_UI_RANKING_TYPE_TABS;

/** @deprecated Use RankingType instead */
export type HomeMode = "buzz" | "rising";

export function parseRankingType(
  rankingValue?: string | null,
  legacyModeValue?: string | null,
): RankingType {
  if (rankingValue && isRankingType(rankingValue)) {
    return rankingValue;
  }

  if (legacyModeValue === "rising") {
    return "early_rise";
  }

  return "buzz";
}

/** Home URL ranking — hidden rankings fall back to buzz */
export function parseHomeRankingType(
  rankingValue?: string | null,
  legacyModeValue?: string | null,
): HomeUiRankingType {
  return normalizeHomeUiRanking(parseRankingType(rankingValue, legacyModeValue));
}

export function rankingTypeToLegacyMode(ranking: RankingType): HomeMode {
  return ranking === "early_rise" ? "rising" : "buzz";
}
