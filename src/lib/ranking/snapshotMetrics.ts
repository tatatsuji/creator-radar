import { computeRawTrendingMetrics, getPeriodHours } from "@/lib/ranking/score";
import { buildVideoMetrics } from "@/lib/ranking/metrics";
import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { MetricsSource, RankingPeriod, Video, VideoMetrics } from "@/types";
import type { VideoSnapshotRow } from "@/types/database";

const MAX_DRIFT_RATIO = 0.25;

export interface SnapshotPeriodMetrics {
  viewDelta: number;
  viewVelocity: number;
  viewsPerSubscriber: number;
  metricsSource: MetricsSource;
  baselineCapturedAt: string;
}

function getMaxDriftMs(period: RankingPeriod): number {
  return getPeriodHours(period) * 60 * 60 * 1000 * MAX_DRIFT_RATIO;
}

function findClosestSnapshot(
  snapshots: VideoSnapshotRow[],
  targetMs: number,
): VideoSnapshotRow | null {
  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.reduce<VideoSnapshotRow | null>((closest, snapshot) => {
    const snapshotMs = new Date(snapshot.captured_at).getTime();
    const diff = Math.abs(snapshotMs - targetMs);

    if (!closest) {
      return snapshot;
    }

    const closestDiff = Math.abs(
      new Date(closest.captured_at).getTime() - targetMs,
    );
    return diff < closestDiff ? snapshot : closest;
  }, null);
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
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const targetMs = nowMs - getPeriodHours(input.period) * 60 * 60 * 1000;
  const baseline = findClosestSnapshot(input.snapshots, targetMs);

  if (!baseline) {
    return null;
  }

  const baselineMs = new Date(baseline.captured_at).getTime();
  const driftMs = Math.abs(baselineMs - targetMs);

  if (driftMs > getMaxDriftMs(input.period)) {
    return null;
  }

  if (baselineMs >= nowMs) {
    return null;
  }

  const viewDelta = Math.max(0, input.currentViewCount - baseline.view_count);
  const hoursElapsed = Math.max((nowMs - baselineMs) / (1000 * 60 * 60), 1);
  const viewVelocity = viewDelta / hoursElapsed;
  const viewsPerSubscriber =
    !input.subscriberCountHidden && input.subscriberCount > 0
      ? viewDelta / input.subscriberCount
      : 0;

  return {
    viewDelta,
    viewVelocity,
    viewsPerSubscriber,
    metricsSource: "measured",
    baselineCapturedAt: baseline.captured_at,
  };
}

export function buildMetricsWithSnapshotFallback(input: {
  period: RankingPeriod;
  viewCount: number;
  subscriberCount: number;
  subscriberCountHidden: boolean;
  publishedAt: string;
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
      measuredViewDelta: measured.viewDelta,
      measuredViewVelocity: measured.viewVelocity,
      measuredViewsPerSubscriber: measured.viewsPerSubscriber,
    });

    return {
      period: input.period,
      viewDelta: measured.viewDelta,
      viewVelocity: measured.viewVelocity,
      viewsPerSubscriber: measured.viewsPerSubscriber,
      rankingScore: 0,
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
  );

  return {
    ...estimated,
    rankingScore: 0,
    metricsSource: "estimated",
  };
}

export async function mergeSnapshotMetricsIntoVideos(
  videos: Array<
    Video & {
      metrics: Video["metrics"] & { rawScore?: number };
    }
  >,
  period: RankingPeriod,
): Promise<
  Array<
    Video & {
      metrics: Video["metrics"] & { rawScore?: number };
    }
  >
> {
  if (!isSupabaseConfigured() || videos.length === 0) {
    return videos.map((video) => ({
      ...video,
      metrics: {
        ...video.metrics,
        metricsSource: video.metrics.metricsSource ?? "estimated",
      },
    }));
  }

  const snapshotsByVideo = await fetchSnapshotsForVideos(
    videos.map((video) => video.id),
  );

  return videos.map((video) => {
    const snapshots = snapshotsByVideo.get(video.id) ?? [];

    if (snapshots.length < 2) {
      return {
        ...video,
        metrics: {
          ...video.metrics,
          metricsSource: "estimated" as MetricsSource,
        },
      };
    }

    const metrics = buildMetricsWithSnapshotFallback({
      period,
      viewCount: video.viewCount,
      subscriberCount: video.channel.subscriberCount,
      subscriberCountHidden: video.channel.subscriberCountHidden ?? false,
      publishedAt: video.publishedAt,
      snapshots,
    });

    return {
      ...video,
      metrics,
    };
  });
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
