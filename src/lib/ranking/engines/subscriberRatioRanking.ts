import {
  formatCount,
  formatSubscriberCount,
  formatViewDelta,
  formatViewsPerSubscriber,
} from "@/lib/format";
import { finalizeRankedVideos } from "@/lib/ranking/metrics";
import { getVelocityDisplay } from "@/lib/ranking/metrics";
import { getViewDeltaLabel } from "@/lib/ranking/periods";
import {
  MAX_RANKING_RESULTS,
  RANKING_SCORE_NAMES,
} from "@/lib/ranking/rankingMeta";
import type { RankingPeriod, Video, VideoMetrics } from "@/types";

const MIN_VIEW_COUNT = 1_000;

type VideoWithRawScore = Video & {
  metrics: VideoMetrics & { rawScore?: number };
};

export function isSubscriberRatioEligible(video: Video): boolean {
  if (video.channel.subscriberCountHidden) {
    return false;
  }

  if (video.channel.subscriberCount <= 0) {
    return false;
  }

  if (video.viewCount < MIN_VIEW_COUNT) {
    return false;
  }

  return video.metrics.viewsPerSubscriber > 0;
}

export function scoreSubscriberRatio(ratio: number): number {
  return Math.min(Math.round(ratio * 20), 100);
}

function buildRankReason(video: Video, period: RankingPeriod): string {
  const ratioLabel = formatViewsPerSubscriber(
    video.metrics.viewsPerSubscriber,
    false,
  );
  const subs = formatSubscriberCount(video.channel.subscriberCount);

  if (video.metrics.metricsSource === "measured") {
    return `登録者比 ${ratioLabel} · ${getViewDeltaLabel(period)} ${formatViewDelta(video.metrics.viewDelta)} · 登録者 ${subs}`;
  }

  const velocity = getVelocityDisplay(video, period);
  return `登録者比 ${ratioLabel} · 登録者 ${subs} · 推定 ${velocity.value}${velocity.unit}`;
}

export async function buildSubscriberRatioRankingVideos(
  videos: Video[],
  period: RankingPeriod,
): Promise<Video[]> {
  const ranked = await finalizeRankedVideos(videos as VideoWithRawScore[], period);

  return ranked
    .filter(isSubscriberRatioEligible)
    .sort((left, right) => {
      const ratioDiff =
        right.metrics.viewsPerSubscriber - left.metrics.viewsPerSubscriber;

      if (Math.abs(ratioDiff) > 0.05) {
        return ratioDiff;
      }

      return left.channel.subscriberCount - right.channel.subscriberCount;
    })
    .slice(0, MAX_RANKING_RESULTS)
    .map((video) => {
      const ratio = video.metrics.viewsPerSubscriber;
      const ratioLabel = formatViewsPerSubscriber(ratio, false);
      const score = scoreSubscriberRatio(ratio);

      return {
        ...video,
        metrics: {
          ...video.metrics,
          rankingScore: score,
        },
        rankingDisplay: {
          scoreName: RANKING_SCORE_NAMES.subscriber_ratio,
          scoreValue: score,
          rankReason: buildRankReason(video, period),
          heroLabel: "再生/登録者比",
          heroValue: ratioLabel,
          secondaryLabel: "登録者数",
          secondaryValue: formatCount(video.channel.subscriberCount),
        },
      };
    });
}
