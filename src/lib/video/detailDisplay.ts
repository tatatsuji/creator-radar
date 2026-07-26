import {
  formatCount,
  formatHoursSincePublish,
  formatViewDelta,
  formatViewsPerSubscriber,
} from "@/lib/format";
import { getVelocityDisplay, getVelocityLabel } from "@/lib/ranking/metrics";
import { getPeriodLabel, getViewDeltaLabel } from "@/lib/ranking/periods";
import type { MetricsSource, RankingPeriod, Video } from "@/types";

export const ESTIMATED_METRICS_EXPLANATION =
  "推定: 公開後の平均値から算出";
export const MEASURED_METRICS_EXPLANATION =
  "実測: 定期取得したスナップショットから算出";

export interface DetailSummaryLine {
  text: string;
}

export function getDetailSummaryLines(
  video: Video,
  period: RankingPeriod,
): DetailSummaryLine[] {
  const velocity = getVelocityDisplay(video, period);

  return [
    {
      text: `${getViewDeltaLabel(period)} ${formatViewDelta(video.metrics.viewDelta)}`,
    },
    {
      text: `現在 ${velocity.value}${velocity.unit}（${getVelocityLabel(video.metrics.metricsSource)}）`,
    },
    {
      text: `登録者比 ${formatViewsPerSubscriber(
        video.metrics.viewsPerSubscriber,
        video.channel.subscriberCountHidden,
      )}`,
    },
    {
      text: formatHoursSincePublish(video.publishedAt),
    },
  ];
}

export function getMetricsSourceExplanation(
  source?: MetricsSource,
): string {
  return source === "measured"
    ? MEASURED_METRICS_EXPLANATION
    : ESTIMATED_METRICS_EXPLANATION;
}

export function formatRankingScoreValue(score: number): string {
  return `${Math.round(score)} / 100`;
}

export function getPeriodIncreaseLabel(period: RankingPeriod): string {
  return `${getPeriodLabel(period)}の増加`;
}

export function formatTotalViews(value: number): string {
  return `${formatCount(value)}回`;
}
