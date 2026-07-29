import type { RankingType } from "@/types/ranking";

export interface RankingTypeTab {
  id: RankingType;
  label: string;
}

export const RANKING_TYPE_LABELS: Record<RankingType, string> = {
  buzz: "バズ動画",
  early_rise: "伸び始め",
  launch_speed: "初速",
  potential: "伸びそう",
};

export const RANKING_TYPE_TITLES: Record<RankingType, string> = {
  buzz: "バズ動画ランキング",
  early_rise: "伸び始めランキング",
  launch_speed: "初速ランキング",
  potential: "伸びそうランキング",
};

export const RANKING_TYPE_DESCRIPTIONS: Record<RankingType, string> = {
  buzz: "現在、日本のYouTubeで大きく伸びている動画を表示します。期間内の再生増加と推定指標を組み合わせて並べます。",
  early_rise: "直近の計測データから、再生速度が加速し始めている動画を表示します。実測スナップショットのみを使います。",
  launch_speed: "公開から間もない動画のうち、1時間あたりの実測再生速度が高いものを表示します。",
  potential: "実測速度・加速度・ジャンル比較から、今後伸びやすい動画をスコア化して表示します。",
};

/** One-line comparison shown on the home page guide */
export const RANKING_TYPE_ONE_LINERS: Record<RankingType, string> = {
  buzz: "今、話題になっている動画",
  early_rise: "再生が加速し始めた動画",
  launch_speed: "公開直後から速い動画",
  potential: "これから伸びそうな動画",
};

/** What makes a video rank here — shown on cards */
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

/** Buzz ranking display and quality limits */
export const MAX_BUZZ_RANKING_RESULTS = 100;
export const MIN_BUZZ_RANKING_TARGET = 50;
export const MAX_BUZZ_VIDEOS_PER_CHANNEL = 5;
export const BUZZ_INITIAL_DISPLAY_COUNT = 25;
export const BUZZ_CANDIDATE_POOL_SIZE = 300;

/** Phase2: seven first-class ranking perspectives */
export type RankingViewId = RankingType | "genre" | "shorts" | "live";

export interface RankingViewDefinition {
  id: RankingViewId;
  label: string;
  oneLiner: string;
  description: string;
}

export const RANKING_VIEW_DEFINITIONS: RankingViewDefinition[] = [
  {
    id: "buzz",
    label: RANKING_TYPE_LABELS.buzz,
    oneLiner: RANKING_TYPE_ONE_LINERS.buzz,
    description: RANKING_TYPE_DESCRIPTIONS.buzz,
  },
  {
    id: "early_rise",
    label: RANKING_TYPE_LABELS.early_rise,
    oneLiner: RANKING_TYPE_ONE_LINERS.early_rise,
    description: RANKING_TYPE_DESCRIPTIONS.early_rise,
  },
  {
    id: "launch_speed",
    label: RANKING_TYPE_LABELS.launch_speed,
    oneLiner: RANKING_TYPE_ONE_LINERS.launch_speed,
    description: RANKING_TYPE_DESCRIPTIONS.launch_speed,
  },
  {
    id: "potential",
    label: RANKING_TYPE_LABELS.potential,
    oneLiner: RANKING_TYPE_ONE_LINERS.potential,
    description: RANKING_TYPE_DESCRIPTIONS.potential,
  },
  {
    id: "genre",
    label: "ジャンル別",
    oneLiner: "ゲーム・教育など、ジャンルで絞った伸び",
    description:
      "同じジャンル内で伸びている動画を比較できます。自分のチャンネルジャンルに近い動画を探すときに使います。",
  },
  {
    id: "shorts",
    label: "Shorts",
    oneLiner: "短尺で今伸びている動画",
    description:
      "Shorts形式に絞って、縦型・短尺の伸び方を確認できます。初速と拡散の参考に使います。",
  },
  {
    id: "live",
    label: "ライブ",
    oneLiner: "配信中・急上昇のライブ",
    description:
      "ライブ配信に絞って、リアルタイムで伸びている配信を確認できます。",
  },
];

export function getRankingViewDefinition(
  id: RankingViewId,
): RankingViewDefinition {
  return (
    RANKING_VIEW_DEFINITIONS.find((view) => view.id === id) ??
    RANKING_VIEW_DEFINITIONS[0]!
  );
}
