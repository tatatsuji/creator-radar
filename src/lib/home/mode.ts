import { HOME_MODE_LABELS } from "@/lib/home/copy";
import {
  parseRankingType,
  rankingTypeToLegacyMode,
} from "@/lib/home/rankingType";

/** @deprecated Use RankingType instead */
export type HomeMode = "buzz" | "rising";

export const HOME_MODES: { id: HomeMode; label: string }[] = [
  { id: "buzz", label: HOME_MODE_LABELS.buzz },
  { id: "rising", label: HOME_MODE_LABELS.rising },
];

export function parseHomeMode(value?: string | null): HomeMode {
  return rankingTypeToLegacyMode(parseRankingType(null, value));
}

export function isHomeMode(value: string): value is HomeMode {
  return value === "buzz" || value === "rising";
}

export type { RankingType } from "@/types/ranking";
export {
  parseRankingType,
  rankingTypeToLegacyMode,
  RANKING_TYPE_TABS,
} from "@/lib/home/rankingType";
