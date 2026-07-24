import {
  computeRawTrendingMetrics,
  getPeriodHours,
  normalizeTrendingScores,
} from "@/lib/ranking/score";
import type { RankingPeriod, Video, VideoMetrics } from "@/types";

export function buildVideoMetrics(
  period: RankingPeriod,
  viewCount: number,
  subscriberCount: number,
  subscriberCountHidden: boolean,
  publishedAt: string,
): Omit<VideoMetrics, "rankingScore"> & { rawScore: number } {
  const raw = computeRawTrendingMetrics({
    viewCount,
    subscriberCount,
    subscriberCountHidden,
    publishedAt,
    period,
  });

  return {
    period,
    viewDelta: raw.viewDelta,
    viewVelocity: raw.viewVelocity,
    viewsPerSubscriber: raw.viewsPerSubscriber,
    metricsSource: "estimated",
    rawScore: raw.rawScore,
  };
}

export function applyTrendingScores(
  videos: Array<Video & { metrics: VideoMetrics & { rawScore?: number } }>,
): Video[] {
  const rawScores = videos.map(
    (video) => video.metrics.rawScore ?? video.metrics.rankingScore,
  );
  const normalizedScores = normalizeTrendingScores(rawScores);

  return videos.map((video, index) => ({
    ...video,
    metrics: {
      period: video.metrics.period,
      viewDelta: video.metrics.viewDelta,
      viewVelocity: video.metrics.viewVelocity,
      viewsPerSubscriber: video.metrics.viewsPerSubscriber,
      rankingScore: normalizedScores[index] ?? 0,
      metricsSource: video.metrics.metricsSource ?? "estimated",
    },
  }));
}

export function getVelocityDisplay(
  video: Video,
  period: RankingPeriod,
): { value: string; unit: string; numeric: number } {
  const { viewVelocity } = video.metrics;

  if (period === "24h") {
    return { value: formatVelocity(viewVelocity), unit: "回/時", numeric: viewVelocity };
  }

  const perDay = viewVelocity * 24;
  return { value: formatVelocity(perDay), unit: "回/日", numeric: perDay };
}

function formatVelocity(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
}

export function parseRankingPeriod(value?: string | null): RankingPeriod {
  if (value === "3d" || value === "7d") {
    return value;
  }
  return "24h";
}

export { getPeriodHours };
