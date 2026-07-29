import type { RankingType } from "@/types/ranking";

export interface RankingTypeTab {
  id: RankingType;
  label: string;
}

export const RANKING_TYPE_LABELS: Record<RankingType, string> = {
  buzz: "バズ",
  early_rise: "伸び始め",
};

export const RANKING_TYPE_TITLES: Record<RankingType, string> = {
  buzz: "バズ動画",
  early_rise: "伸び始め",
};

export const RANKING_TYPE_DESCRIPTIONS: Record<RankingType, string> = {
  buzz: "今、日本で話題になっている動画。流行を追いたいときに使います。",
  early_rise:
    "再生が加速し始めた動画。まだ大きくなる前の候補を見つけたいときに使います。",
};

export const RANKING_TYPE_ONE_LINERS: Record<RankingType, string> = {
  buzz: "今、話題になっている動画",
  early_rise: "これから伸びそうな動画",
};

export const RANKING_TYPE_WHY_PREFIX: Record<RankingType, string> = {
  buzz: "話題化",
  early_rise: "加速",
};

export const RANKING_SCORE_NAMES: Record<RankingType, string> = {
  buzz: "バズスコア",
  early_rise: "加速スコア",
};

export const RANKING_ACCUMULATING_MESSAGES: Record<RankingType, string> = {
  buzz: "",
  early_rise:
    "伸び始めを判定するには、動画ごとに複数時点の実測スナップショットが必要です。計測を継続しています。",
};

export const MAX_RANKING_RESULTS = 100;

export const MAX_BUZZ_RANKING_RESULTS = 100;
export const MIN_BUZZ_RANKING_TARGET = 50;
export const MAX_BUZZ_VIDEOS_PER_CHANNEL = 5;
export const BUZZ_INITIAL_DISPLAY_COUNT = 25;
export const BUZZ_CANDIDATE_POOL_SIZE = 300;

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
