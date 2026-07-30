import { getCardHeroMetric } from "@/lib/ranking/cardDisplay";
import { getPeriodLabel } from "@/lib/ranking/periods";
import { formatViewDelta } from "@/lib/format";

import type { BuzzRankingAnalysis, VideoAnalysisInput } from "./types";

function buildLeadAnswer(input: VideoAnalysisInput): string {
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
    disclaimer: "公開データと計測値から自動生成しています。",
    provider: "rule_based",
  };
}
