import type { HomeUiRankingType, RankingType } from "@/types/ranking";
import { HOME_UI_RANKING_TYPES } from "@/types/ranking";

export interface RankingTypeTab {
  id: HomeUiRankingType;
  label: string;
}

export const RANKING_TYPE_LABELS: Record<RankingType, string> = {
  buzz: "バズ動画",
  early_rise: "伸び始め",
  launch_speed: "初速",
  potential: "伸びそう",
};

export const HOME_UI_RANKING_LABELS: Record<HomeUiRankingType, string> = {
  buzz: RANKING_TYPE_LABELS.buzz,
  early_rise: RANKING_TYPE_LABELS.early_rise,
};

export const RANKING_TYPE_TITLES: Record<RankingType, string> = {
  buzz: "バズ動画",
  early_rise: "伸び始め",
  launch_speed: "初速ランキング",
  potential: "伸びそうランキング",
};

export const RANKING_TYPE_DESCRIPTIONS: Record<RankingType, string> = {
  buzz: "今、日本で話題になっている動画。流行を追いたいときに使います。",
  early_rise:
    "再生が加速し始めた動画。まだ大きくなる前の候補を見つけたいときに使います。",
  launch_speed:
    "公開から間もない動画のうち、1時間あたりの実測再生速度が高いものを表示します。",
  potential:
    "実測速度・加速度・ジャンル比較から、今後伸びやすい動画をスコア化して表示します。",
};

export const HOME_UI_RANKING_DESCRIPTIONS: Record<HomeUiRankingType, string> = {
  buzz: RANKING_TYPE_DESCRIPTIONS.buzz,
  early_rise: RANKING_TYPE_DESCRIPTIONS.early_rise,
};

export const HOME_UI_RANKING_TITLES: Record<HomeUiRankingType, string> = {
  buzz: RANKING_TYPE_TITLES.buzz,
  early_rise: RANKING_TYPE_TITLES.early_rise,
};

export const RANKING_TYPE_ONE_LINERS: Record<RankingType, string> = {
  buzz: "今、話題になっている動画",
  early_rise: "再生が加速し始めた動画",
  launch_speed: "公開直後から速い動画",
  potential: "これから伸びそうな動画",
};

export const HOME_UI_RANKING_ONE_LINERS: Record<HomeUiRankingType, string> = {
  buzz: RANKING_TYPE_ONE_LINERS.buzz,
  early_rise: RANKING_TYPE_ONE_LINERS.early_rise,
};

export const RANKING_TYPE_WHY_PREFIX: Record<RankingType, string> = {
  buzz: "話題化",
  early_rise: "加速",
  launch_speed: "初速",
  potential: "伸び予兆",
};

export const RANKING_SCORE_NAMES: Record<RankingType, string> = {
  buzz: "バズスコア",
  early_rise: "加速スコア",
  launch_speed: "初速スコア",
  potential: "伸び予測スコア",
};

export const RANKING_ACCUMULATING_MESSAGES: Record<RankingType, string> = {
  buzz: "",
  early_rise:
    "伸び始めを判定するには、動画ごとに複数時点の実測スナップショットが必要です。計測を継続しています。",
  launch_speed:
    "初速を判定するには、公開後の実測スナップショットが必要です。計測を継続しています。",
  potential:
    "伸び予測には、速度・加速度の実測データが必要です。計測を継続しています。",
};

export const MAX_RANKING_RESULTS = 100;

export const MAX_BUZZ_RANKING_RESULTS = 100;
export const MIN_BUZZ_RANKING_TARGET = 50;
export const MAX_BUZZ_VIDEOS_PER_CHANNEL = 5;
export const BUZZ_INITIAL_DISPLAY_COUNT = 25;
export const BUZZ_CANDIDATE_POOL_SIZE = 300;

export const HOME_UI_RANKING_TYPE_TABS: RankingTypeTab[] =
  HOME_UI_RANKING_TYPES.map((id) => ({
    id,
    label: HOME_UI_RANKING_LABELS[id],
  }));

/** Display filters — not separate rankings */
export type ContentFilterViewId = "genre" | "shorts" | "live";

export interface ContentFilterDefinition {
  id: ContentFilterViewId;
  label: string;
  oneLiner: string;
  description: string;
}

export const CONTENT_FILTER_DEFINITIONS: ContentFilterDefinition[] = [
  {
    id: "genre",
    label: "ジャンル",
    oneLiner: "ゲーム・教育などで絞り込み",
    description:
      "同じジャンル内の動画に絞って比較できます。自分のチャンネルに近い伸びを探すときに使います。",
  },
  {
    id: "shorts",
    label: "Shorts",
    oneLiner: "短尺動画だけ表示",
    description: "Shorts形式だけを表示します。バズ / 伸び始めのどちらにも適用できます。",
  },
  {
    id: "live",
    label: "ライブ",
    oneLiner: "ライブ配信だけ表示",
    description: "ライブ配信だけを表示します。バズ / 伸び始めのどちらにも適用できます。",
  },
];

export function getContentFilterDefinition(
  id: ContentFilterViewId,
): ContentFilterDefinition {
  return (
    CONTENT_FILTER_DEFINITIONS.find((filter) => filter.id === id) ??
    CONTENT_FILTER_DEFINITIONS[0]!
  );
}
