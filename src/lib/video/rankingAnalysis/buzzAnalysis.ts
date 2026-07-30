import { formatCount, formatViewDelta } from "@/lib/format";
import { getCardHeroMetric } from "@/lib/ranking/cardDisplay";
import { getPeriodLabel } from "@/lib/ranking/periods";

import type { BuzzRankingAnalysis, VideoAnalysisInput } from "./types";

function buildMeasuredLeadAnswer(input: VideoAnalysisInput): string {
  const { video, period } = input;
  const rankReason = video.rankingDisplay?.rankReason;

  if (rankReason && video.metrics.viewDelta > 0) {
    return `${rankReason}。${getPeriodLabel(period)}で${formatViewDelta(video.metrics.viewDelta)}の再生増です。`;
  }

  if (video.metrics.viewDelta > 0) {
    return `${getPeriodLabel(period)}で${formatViewDelta(video.metrics.viewDelta)}の再生増があり、いま注目を集めています。`;
  }

  if (rankReason) {
    return `${rankReason}。`;
  }

  return "いま再生の勢いが強く、話題になりやすい流れに乗っています。";
}

function buildEstimatedLeadAnswer(input: VideoAnalysisInput): string {
  const { video, period } = input;
  const rankReason = video.rankingDisplay?.rankReason;

  if (video.metrics.viewDelta > 0) {
    const estimatedGrowth = `公開後の平均再生速度から、${getPeriodLabel(period)}で約${formatCount(video.metrics.viewDelta)}回伸びたと推定されます。`;
    if (rankReason) {
      return `${rankReason}。${estimatedGrowth}`;
    }
    return `${estimatedGrowth}いま注目を集めやすい流れに乗っています。`;
  }

  if (rankReason) {
    return `${rankReason}。`;
  }

  return "公開後の平均再生速度から、いま再生の勢いが強いと推定されます。";
}

function buildLeadAnswer(input: VideoAnalysisInput): string {
  if (input.video.metrics.metricsSource === "measured") {
    return buildMeasuredLeadAnswer(input);
  }

  return buildEstimatedLeadAnswer(input);
}

function buildDisclaimer(input: VideoAnalysisInput): string {
  if (input.video.metrics.metricsSource === "measured") {
    return "公開データと計測値から自動生成しています。";
  }

  return "公開データをもとに自動推定しています。";
}

function buildDetails(input: VideoAnalysisInput): string[] {
  const { video, period } = input;
  const details: string[] = [];
  const hero = getCardHeroMetric(video, period);

  details.push(`${hero.label}は${hero.value}。`);

  if (!video.channel.subscriberCountHidden && video.metrics.viewsPerSubscriber >= 1) {
    details.push(
      "チャンネル登録者数を上回る再生になっており、ファン以外にも広く見られ始めています。",
    );
  }

  return details.slice(0, 2);
}

export function buildBuzzRankingAnalysis(
  input: VideoAnalysisInput,
): BuzzRankingAnalysis {
  const hero = getCardHeroMetric(input.video, input.period);

  return {
    kind: "buzz",
    leadAnswer: buildLeadAnswer(input),
    momentumLabel: hero.label,
    momentumValue: hero.value,
    details: buildDetails(input),
    disclaimer: buildDisclaimer(input),
    provider: "rule_based",
  };
}
