import { getCardHeroMetric } from "@/lib/ranking/cardDisplay";
import { getPeriodLabel } from "@/lib/ranking/periods";
import { formatViewDelta } from "@/lib/format";

import type { BuzzRankingAnalysis, VideoAnalysisInput } from "./types";

const CONTENT_KIND_LABELS = {
  short: "Shorts",
  live: "ライブ配信",
  regular: "通常動画",
  unknown: "動画",
} as const;

function buildOverview(video: VideoAnalysisInput["video"]): string {
  const kind =
    CONTENT_KIND_LABELS[video.contentKind ?? "unknown"] ?? "動画";
  return `${video.channel.name}の${kind}。${getPeriodLabel(video.metrics.period)}のデータで追跡中です。`;
}

function buildWhyTrendingParagraphs(input: VideoAnalysisInput): string {
  const { video, period } = input;
  const lines: string[] = [];
  const rankReason = video.rankingDisplay?.rankReason;
  const hero = getCardHeroMetric(video, period);
  const kindLabel =
    CONTENT_KIND_LABELS[video.contentKind ?? "unknown"] ?? "動画";

  if (rankReason) {
    lines.push(`${rankReason}。`);
  }

  if (video.metrics.viewDelta > 0) {
    lines.push(
      `${getPeriodLabel(period)}だけで再生が${formatViewDelta(video.metrics.viewDelta)}増えており、いま注目を集めています。`,
    );
  } else {
    lines.push(
      `推定データ上、${getPeriodLabel(period)}の勢いが高い状態です。`,
    );
  }

  lines.push(
    `${hero.label}は${hero.value}。${kindLabel}として、いまYouTube上で話題になりやすい流れに乗っている可能性があります。`,
  );

  if (!video.channel.subscriberCountHidden && video.metrics.viewsPerSubscriber >= 1) {
    lines.push(
      `チャンネル登録者数を上回る再生数になっており、ファン以外にも広く見られ始めているサインです。`,
    );
  }

  const trimmed = lines.slice(0, 4);
  return trimmed.join("\n");
}

export function buildBuzzRankingAnalysis(
  input: VideoAnalysisInput,
): BuzzRankingAnalysis {
  const hero = getCardHeroMetric(input.video, input.period);

  return {
    kind: "buzz",
    momentumLabel: hero.label,
    momentumValue: hero.value,
    overview: buildOverview(input.video),
    whyTrendingNow: buildWhyTrendingParagraphs(input),
    disclaimer:
      "この説明は公開データと計測値から自動生成しています。話題の理由は1つに限られない場合があります。",
    provider: "rule_based",
  };
}
