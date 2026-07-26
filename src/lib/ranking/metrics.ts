import {
  computeRadarScore,
  computeRawTrendingMetrics,
} from "@/lib/ranking/score";
import { mergeSnapshotMetricsIntoVideos } from "@/lib/ranking/snapshotMetrics";
import type { RankingPeriod, Video, VideoMetrics } from "@/types";

export const ESTIMATED_VELOCITY_LABEL = "公開後平均再生速度（推定）";

type VideoWithRawScore = Video & {
  metrics: VideoMetrics & { rawScore?: number };
};

export function buildVideoMetrics(
  period: RankingPeriod,
  viewCount: number,
  subscriberCount: number,
  subscriberCountHidden: boolean,
  publishedAt: string,
  channelName?: string,
): VideoMetrics & { rawScore: number } {
  const raw = computeRawTrendingMetrics({
    viewCount,
    subscriberCount,
    subscriberCountHidden,
    publishedAt,
    period,
    channelName,
  });

  return {
    period,
    viewDelta: raw.viewDelta,
    viewVelocity: raw.viewVelocity,
    viewsPerSubscriber: raw.viewsPerSubscriber,
    rankingScore: computeRadarScore(raw.rawScore),
    metricsSource: "estimated",
    rawScore: raw.rawScore,
  };
}

export function applyRadarScores(videos: VideoWithRawScore[]): Video[] {
  return videos.map((video) => ({
    ...video,
    metrics: {
      period: video.metrics.period,
      viewDelta: video.metrics.viewDelta,
      viewVelocity: video.metrics.viewVelocity,
      viewsPerSubscriber: video.metrics.viewsPerSubscriber,
      rankingScore: computeRadarScore(
        video.metrics.rawScore ?? video.metrics.rankingScore,
      ),
      metricsSource: video.metrics.metricsSource ?? "estimated",
    },
  }));
}

export async function finalizeRankedVideos(
  videos: VideoWithRawScore[],
  period: RankingPeriod,
): Promise<Video[]> {
  const { videos: withSnapshotMetrics } = await mergeSnapshotMetricsIntoVideos(
    videos,
    period,
  );

  return applyRadarScores(withSnapshotMetrics).sort((a, b) => {
    const scoreDiff = b.metrics.rankingScore - a.metrics.rankingScore;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return b.metrics.viewVelocity - a.metrics.viewVelocity;
  });
}

export function getVelocityLabel(metricsSource?: VideoMetrics["metricsSource"]): string {
  return metricsSource === "measured" ? "再生速度" : ESTIMATED_VELOCITY_LABEL;
}

export function getVelocityDisplay(
  video: Video,
  period: RankingPeriod,
): { value: string; unit: string; numeric: number } {
  const { viewVelocity } = video.metrics;

  if (period === "24h") {
    return {
      value: formatVelocity(viewVelocity),
      unit: "回/時",
      numeric: viewVelocity,
    };
  }

  const perDay = viewVelocity * 24;
  return {
    value: formatVelocity(perDay),
    unit: "回/日",
    numeric: perDay,
  };
}

function formatVelocity(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
}

export {
  getPeriodHours,
  getPeriodLabel,
  getPublishedAfter,
  parseRankingPeriod,
  RANKING_PERIODS,
} from "@/lib/ranking/periods";
