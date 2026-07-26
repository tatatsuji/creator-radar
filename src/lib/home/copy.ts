export const SERVICE_TAGLINE = "YouTubeの「今」と「次」を見える化する。";

export {
  RANKING_ACCUMULATING_MESSAGES,
  RANKING_SCORE_NAMES,
  RANKING_TYPE_DESCRIPTIONS,
  RANKING_TYPE_LABELS,
  RANKING_TYPE_TITLES,
} from "@/lib/ranking/rankingMeta";

/** @deprecated Use RANKING_TYPE_LABELS.buzz */
export const BUZZ_VIDEOS_LABEL = "バズ動画";

/** @deprecated Use RANKING_TYPE_LABELS.early_rise */
export const RISING_VIDEOS_LABEL = "伸び始め";

export const RANKING_REFERENCE_LABEL = "ランキング参考値";

export const HOME_MODE_LABELS = {
  buzz: "バズ動画",
  rising: "伸び始め",
} as const;
