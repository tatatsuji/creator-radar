import {
  RANKING_TYPE_LABELS,
  type RankingTypeTab,
} from "@/lib/ranking/rankingMeta";
import { isRankingType, RANKING_TYPES, type RankingType } from "@/types/ranking";

export type { RankingType };

export const RANKING_TYPE_TABS: RankingTypeTab[] = RANKING_TYPES.map((id) => ({
  id,
  label: RANKING_TYPE_LABELS[id],
}));

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

export function rankingTypeToLegacyMode(ranking: RankingType): HomeMode {
  return ranking === "early_rise" ? "rising" : "buzz";
}
