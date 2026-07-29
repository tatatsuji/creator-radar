export const SERVICE_TAGLINE = "YouTubeで勝つための、毎日の分析コーチ。";

export {
  RANKING_ACCUMULATING_MESSAGES,
  CONTENT_FILTER_DEFINITIONS,
  HOME_UI_RANKING_DESCRIPTIONS,
  HOME_UI_RANKING_LABELS,
  HOME_UI_RANKING_TITLES,
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
