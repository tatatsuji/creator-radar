import {
  getCardHeroMetric,
  getCardSecondaryVelocity,
  RADAR_SCORE_EXPLANATION,
} from "@/lib/ranking/cardDisplay";
import { getVelocityDisplay, getVelocityLabel } from "@/lib/ranking/metrics";
import { getPeriodLabel, getViewDeltaLabel } from "@/lib/ranking/periods";
import { formatViewDelta, formatViewsPerSubscriber } from "@/lib/format";
import { RANKING_REFERENCE_LABEL } from "@/lib/home/copy";
import {
  formatRankingScoreValue,
  getMetricsSourceExplanation,
} from "@/lib/video/detailDisplay";
import type { RankingPeriod, Video } from "@/types";

export const RANKING_REFERENCE_EXPLANATION = RADAR_SCORE_EXPLANATION;

export interface VideoAnalysisInsight {
  headline: string;
  summary: string;
  highlights: string[];
  rankingReference: {
    label: string;
    value: string;
    note: string;
  };
  dataSourceNote: string;
}

function getRankingReferenceNote(score: number): string {
  if (score >= 70) {
    return "選択した期間内で、相対的に勢いが高い位置にあります。";
  }

  if (score >= 40) {
    return "選択した期間内の中程度の勢いです。他の動画との比較用の参考値です。";
  }

  return "選択した期間内では伸びが限定的です。参考値としてご確認ください。";
}

function getReachHighlight(
  video: Video,
): string | null {
  if (video.channel.subscriberCountHidden) {
    return null;
  }

  const ratio = video.metrics.viewsPerSubscriber;

  if (ratio >= 1) {
    return `登録者数に対して再生が多く（${formatViewsPerSubscriber(ratio, false)}）、届き方が強い傾向があります。`;
  }

  if (ratio >= 0.3) {
    return `登録者数に対する再生比率は ${formatViewsPerSubscriber(ratio, false)} です。`;
  }

  return null;
}

function getHeadline(video: Video, period: RankingPeriod): string {
  const isMeasured = video.metrics.metricsSource === "measured";
  const hasGrowth = video.metrics.viewDelta > 0;

  if (isMeasured && hasGrowth) {
    return `${getPeriodLabel(period)}の伸びが実測で確認されています`;
  }

  if (isMeasured) {
    return "実測データはありますが、この期間の伸びは限定的です";
  }

  if (video.metrics.rankingScore >= 70) {
    return "推定値から、現在の勢いが高い状態です";
  }

  return "推定値で現在の勢いを参照しています";
}

function getSummary(video: Video, period: RankingPeriod): string {
  const isMeasured = video.metrics.metricsSource === "measured";
  const velocity = getVelocityDisplay(video, period);

  if (isMeasured) {
    return `${getViewDeltaLabel(period)}は ${formatViewDelta(video.metrics.viewDelta)}。現在 ${velocity.value}${velocity.unit}（${getVelocityLabel("measured")}）で推移を追跡できます。`;
  }

  return `${getVelocityLabel("estimated")}は ${velocity.value}${velocity.unit}。実測グラフは下記で順次蓄積されます。`;
}

export function getVideoAnalysisInsight(
  video: Video,
  period: RankingPeriod,
): VideoAnalysisInsight {
  const heroMetric = getCardHeroMetric(video, period);
  const secondaryVelocity = getCardSecondaryVelocity(video, period);
  const reachHighlight = getReachHighlight(video);

  const highlights = [
    `${heroMetric.label}: ${heroMetric.value}`,
    ...(secondaryVelocity
      ? [`${secondaryVelocity.label}: ${secondaryVelocity.value}`]
      : []),
    ...(reachHighlight ? [reachHighlight] : []),
  ];

  return {
    headline: getHeadline(video, period),
    summary: getSummary(video, period),
    highlights,
    rankingReference: {
      label: RANKING_REFERENCE_LABEL,
      value: formatRankingScoreValue(video.metrics.rankingScore),
      note: getRankingReferenceNote(video.metrics.rankingScore),
    },
    dataSourceNote: getMetricsSourceExplanation(video.metrics.metricsSource),
  };
}

export function getAnalysisPageTitle(video: Video): string {
  return `${video.title}の伸び分析`;
}

export function getAnalysisPageDescription(video: Video): string {
  return `${video.channel.name} · ${RANKING_REFERENCE_LABEL} ${Math.round(video.metrics.rankingScore)} / 100`;
}
