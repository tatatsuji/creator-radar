import {
  getCardScoreMetric,
  getCardTrendInsight,
} from "@/lib/ranking/cardDisplay";
import {
  RANKING_SCORE_NAMES,
  RANKING_TYPE_LABELS,
  RANKING_TYPE_ONE_LINERS,
  RANKING_TYPE_TITLES,
} from "@/lib/ranking/rankingMeta";
import { formatRankingScoreValue } from "@/lib/video/detailDisplay";
import type { RankingPeriod, Video } from "@/types";
import type { RankingType } from "@/types/ranking";

export interface VideoDetailRankingContext {
  rankingLabel: string;
  rankingTitle: string;
  oneLiner: string;
  whyHere: string;
  userQuestion: string;
  scoreLabel: string;
  scoreValue: string;
  takeaway: string;
  revisitHint: string;
}

const RANKING_USER_QUESTIONS: Record<RankingType, string> = {
  buzz: "なぜ今、話題になっている？",
  early_rise: "なぜ「伸び始め」に入った？",
};

const RANKING_REVISIT_HINTS: Record<RankingType, string> = {
  buzz: "話題の動画は日々入れ替わります。明日また開くと、新しいトレンドが見つかります。",
  early_rise:
    "加速は数日で変わります。明日また確認すると、伸びが続いているか一目で分かります。",
};

function getDetailScoreMetric(
  video: Video,
  ranking: RankingType,
): { label: string; value: string } {
  if (video.rankingDisplay) {
    const metric = getCardScoreMetric(video);
    return {
      label: metric.label,
      value: metric.value,
    };
  }

  return {
    label: RANKING_SCORE_NAMES[ranking],
    value: formatRankingScoreValue(video.metrics.rankingScore),
  };
}

function getTakeaway(
  video: Video,
  ranking: RankingType,
  period: RankingPeriod,
): string {
  const isMeasured = video.metrics.metricsSource === "measured";
  const hasGrowth = video.metrics.viewDelta > 0;
  const rankReason = video.rankingDisplay?.rankReason;

  if (rankReason) {
    return `${rankReason}。下のグラフで推移の継続を確認できます。`;
  }

  if (isMeasured && hasGrowth) {
    const messages: Record<RankingType, string> = {
      buzz: "実測で再生増加が確認できています。勢いが続いているか、グラフで追跡できます。",
      early_rise:
        "実測データ上、再生速度が上がり始めています。加速が続くかグラフで確認しましょう。",
    };
    return messages[ranking];
  }

  if (isMeasured) {
    return "実測データはありますが、この期間の伸びは限定的です。期間を変えると別の傾向が見える場合があります。";
  }

  const estimatedMessages: Record<RankingType, string> = {
    buzz: "推定指標から勢いが高い状態です。実測グラフが蓄積されると、より正確に追跡できます。",
    early_rise:
      "推定では加速の兆候があります。実測データが増えると、伸び始めの判定精度が上がります。",
  };

  return estimatedMessages[ranking];
}

export function getVideoDetailRankingContext(
  video: Video,
  ranking: RankingType,
  period: RankingPeriod,
): VideoDetailRankingContext {
  const scoreMetric = getDetailScoreMetric(video, ranking);

  return {
    rankingLabel: RANKING_TYPE_LABELS[ranking],
    rankingTitle: RANKING_TYPE_TITLES[ranking],
    oneLiner: RANKING_TYPE_ONE_LINERS[ranking],
    whyHere: getCardTrendInsight(video, ranking, period),
    userQuestion: RANKING_USER_QUESTIONS[ranking],
    scoreLabel: scoreMetric.label,
    scoreValue: scoreMetric.value,
    takeaway: getTakeaway(video, ranking, period),
    revisitHint: RANKING_REVISIT_HINTS[ranking],
  };
}

export function getRankingAwarePageDescription(
  video: Video,
  ranking: RankingType,
): string {
  const context = getVideoDetailRankingContext(video, ranking, video.metrics.period);
  return `${video.channel.name} · ${context.whyHere} · ${context.scoreLabel} ${context.scoreValue}`;
}
