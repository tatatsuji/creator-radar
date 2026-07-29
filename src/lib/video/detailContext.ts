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
  launch_speed: "なぜ初速が速い？",
  potential: "なぜ「伸びそう」と判定された？",
  subscriber_ratio: "なぜ登録者比が突出している？",
};

const RANKING_REVISIT_HINTS: Record<RankingType, string> = {
  buzz: "話題の動画は日々入れ替わります。明日また開くと、新しいトレンドが見つかります。",
  early_rise:
    "加速は数日で変わります。明日また確認すると、伸びが続いているか一目で分かります。",
  launch_speed:
    "初速は公開直後が勝負。数時間〜1日後の変化も、この画面で追えます。",
  potential:
    "伸び予兆は計測が進むほど精度が上がります。明日のスコア変化もチェックしてみてください。",
  subscriber_ratio:
    "登録者比の異常値は、拡散のチャンスが来ているサイン。明日も同チャンネルの動きを追うと参考になります。",
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
      launch_speed:
        "公開直後から実測で高い再生速度です。初速の推移はグラフで追えます。",
      potential:
        "実測速度・加速度から伸びの兆候が見えています。計測が進むほど精度が上がります。",
      subscriber_ratio:
        "登録者数に対して再生が突出しています。小規模チャンネルでも届き方が強い状態です。",
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
    launch_speed:
      "推定では初速が高い傾向です。公開直後の実測が入ると、より確かな判断ができます。",
    potential:
      "推定スコアから伸びの可能性が示されています。計測が進むと予測精度が上がります。",
    subscriber_ratio:
      "推定データ上、登録者比が高い傾向です。実測が増えると異常値の精度が上がります。",
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
