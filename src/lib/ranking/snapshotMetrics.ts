import { computeRawTrendingMetrics, computeRadarScore } from "@/lib/ranking/score";
import { getPeriodHours } from "@/lib/ranking/periods";
import { buildVideoMetrics } from "@/lib/ranking/metrics";
import { computeMeasuredSnapshotDelta } from "@/lib/snapshots/measuredDelta";
import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { MetricsSource, RankingPeriod, Video, VideoMetrics } from "@/types";
import type { VideoSnapshotRow } from "@/types/database";

export interface SnapshotPeriodMetrics {
  viewDelta: number;
  viewVelocity: number;
  viewsPerSubscriber: number;
  metricsSource: MetricsSource;
  baselineCapturedAt: string;
}

export function computeSnapshotPeriodMetrics(input: {
  period: RankingPeriod;
  currentViewCount: number;
  subscriberCount: number;
  subscriberCountHidden: boolean;
  publishedAt: string;
  snapshots: VideoSnapshotRow[];
  now?: Date;
}): SnapshotPeriodMetrics | null {
  const measured = computeMeasuredSnapshotDelta({
    windowHours: getPeriodHours(input.period),
    snapshots: input.snapshots,
    currentViewCount: input.currentViewCount,
    now: input.now,
  });

  if (measured.status !== "measured" || measured.viewDelta == null || measured.viewVelocity == null) {
    return null;
  }

  const viewsPerSubscriber =
    !input.subscriberCountHidden && input.subscriberCount > 0
      ? measured.viewDelta / input.subscriberCount
      : 0;

  return {
    viewDelta: measured.viewDelta,
    viewVelocity: measured.viewVelocity,
    viewsPerSubscriber,
    metricsSource: "measured",
    baselineCapturedAt: measured.baselineCapturedAt ?? "",
  };
}

export function buildMetricsWithSnapshotFallback(input: {
  period: RankingPeriod;
  viewCount: number;
  subscriberCount: number;
  subscriberCountHidden: boolean;
  publishedAt: string;
  channelName?: string;
  snapshots: VideoSnapshotRow[];
}): VideoMetrics & { rawScore: number } {
  const measured = computeSnapshotPeriodMetrics({
    period: input.period,
    currentViewCount: input.viewCount,
    subscriberCount: input.subscriberCount,
    subscriberCountHidden: input.subscriberCountHidden,
    publishedAt: input.publishedAt,
    snapshots: input.snapshots,
  });

  if (measured) {
    const raw = computeRawTrendingMetrics({
      viewCount: input.viewCount,
      subscriberCount: input.subscriberCount,
      subscriberCountHidden: input.subscriberCountHidden,
      publishedAt: input.publishedAt,
      period: input.period,
      channelName: input.channelName,
      measuredViewDelta: measured.viewDelta,
      measuredViewVelocity: measured.viewVelocity,
      measuredViewsPerSubscriber: measured.viewsPerSubscriber,
    });

    return {
      period: input.period,
      viewDelta: measured.viewDelta,
      viewVelocity: measured.viewVelocity,
      viewsPerSubscriber: measured.viewsPerSubscriber,
      rankingScore: computeRadarScore(raw.rawScore),
      metricsSource: "measured",
      rawScore: raw.rawScore,
    };
  }

  const estimated = buildVideoMetrics(
    input.period,
    input.viewCount,
    input.subscriberCount,
    input.subscriberCountHidden,
    input.publishedAt,
    input.channelName,
  );

  return {
    ...estimated,
    rankingScore: computeRadarScore(estimated.rawScore),
    metricsSource: "estimated",
  };
}

export function resolveLatestSnapshotCapturedAt(
  snapshotsByVideo: Map<string, VideoSnapshotRow[]>,
): string | null {
  let latest: string | null = null;

  for (const snapshots of snapshotsByVideo.values()) {
    const capturedAt = snapshots.at(-1)?.captured_at ?? null;
    if (capturedAt && (!latest || capturedAt > latest)) {
      latest = capturedAt;
    }
  }

  return latest;
}

export async function mergeSnapshotMetricsIntoVideos(
  videos: Array<
    Video & {
      metrics: Video["metrics"] & { rawScore?: number };
    }
  >,
  period: RankingPeriod,
): Promise<{
  videos: Array<
    Video & {
      metrics: Video["metrics"] & { rawScore?: number };
    }
  >;
  latestSnapshotAt: string | null;
}> {
  if (!isSupabaseConfigured() || videos.length === 0) {
    return {
      videos: videos.map((video) => ({
        ...video,
        metrics: {
          ...video.metrics,
          metricsSource: video.metrics.metricsSource ?? "estimated",
        },
      })),
      latestSnapshotAt: null,
    };
  }

  const snapshotsByVideo = await fetchSnapshotsForVideos(
    videos.map((video) => video.id),
  );
  const latestSnapshotAt = resolveLatestSnapshotCapturedAt(snapshotsByVideo);

  const mergedVideos = videos.map((video) => {
    const snapshots = snapshotsByVideo.get(video.id) ?? [];

    if (snapshots.length < 2) {
      const metrics = buildVideoMetrics(
        period,
        video.viewCount,
        video.channel.subscriberCount,
        video.channel.subscriberCountHidden ?? false,
        video.publishedAt,
        video.channel.name,
      );

      return {
        ...video,
        metrics,
      };
    }

    const metrics = buildMetricsWithSnapshotFallback({
      period,
      viewCount: video.viewCount,
      subscriberCount: video.channel.subscriberCount,
      subscriberCountHidden: video.channel.subscriberCountHidden ?? false,
      publishedAt: video.publishedAt,
      channelName: video.channel.name,
      snapshots,
    });

    return {
      ...video,
      metrics,
    };
  });

  return {
    videos: mergedVideos,
    latestSnapshotAt,
  };
}

export function getSnapshotMetricsSummary(
  videos: Video[],
): { measured: number; estimated: number } {
  return videos.reduce(
    (summary, video) => {
      if (video.metrics.metricsSource === "measured") {
        summary.measured += 1;
      } else {
        summary.estimated += 1;
      }
      return summary;
    },
    { measured: 0, estimated: 0 },
  );
}
