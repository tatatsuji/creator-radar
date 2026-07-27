import { buildMetricsWithSnapshotFallback } from "@/lib/ranking/snapshotMetrics";
import { getPeriodHours } from "@/lib/ranking/periods";
import { computeMeasuredSnapshotDelta } from "@/lib/snapshots/measuredDelta";
import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";
import type { RankingPeriod } from "@/types";
import type { VideoSnapshotRow } from "@/types/database";

export interface BuzzSnapshotDistribution {
  totalCandidates: number;
  snapshotZero: number;
  snapshotOne: number;
  snapshotTwoOrMore: number;
  inPeriodSnapshotTwoOrMore: number;
  twoOrMoreButEstimated: number;
  measuredCount: number;
  estimatedCount: number;
  insufficientDueToBaselineDrift: number;
}

function countSnapshotsInPeriod(
  snapshots: VideoSnapshotRow[],
  period: RankingPeriod,
  nowMs: number,
): number {
  const windowStartMs = nowMs - getPeriodHours(period) * 60 * 60 * 1000;
  return snapshots.filter(
    (snapshot) => new Date(snapshot.captured_at).getTime() >= windowStartMs,
  ).length;
}

function isEstimatedDespiteTwoOrMoreSnapshots(input: {
  period: RankingPeriod;
  viewCount: number;
  subscriberCount: number;
  subscriberCountHidden: boolean;
  publishedAt: string;
  snapshots: VideoSnapshotRow[];
}): boolean {
  if (input.snapshots.length < 2) {
    return false;
  }

  const metrics = buildMetricsWithSnapshotFallback(input);
  return metrics.metricsSource === "estimated";
}

function hasBaselineDriftFailure(input: {
  period: RankingPeriod;
  snapshots: VideoSnapshotRow[];
  viewCount: number;
}): boolean {
  if (input.snapshots.length < 2) {
    return false;
  }

  const measured = computeMeasuredSnapshotDelta({
    windowHours: getPeriodHours(input.period),
    snapshots: input.snapshots,
    currentViewCount: input.viewCount,
  });

  return measured.status !== "measured";
}

export async function analyzeBuzzSnapshotDistribution(input: {
  videoIds: string[];
  period: RankingPeriod;
  viewCountByVideoId?: Map<string, number>;
  subscriberCountByVideoId?: Map<string, number>;
  publishedAtByVideoId?: Map<string, string>;
}): Promise<BuzzSnapshotDistribution> {
  const snapshotsByVideo = await fetchSnapshotsForVideos(input.videoIds);
  const nowMs = Date.now();

  const distribution: BuzzSnapshotDistribution = {
    totalCandidates: input.videoIds.length,
    snapshotZero: 0,
    snapshotOne: 0,
    snapshotTwoOrMore: 0,
    inPeriodSnapshotTwoOrMore: 0,
    twoOrMoreButEstimated: 0,
    measuredCount: 0,
    estimatedCount: 0,
    insufficientDueToBaselineDrift: 0,
  };

  for (const videoId of input.videoIds) {
    const snapshots = snapshotsByVideo.get(videoId) ?? [];
    const count = snapshots.length;

    if (count === 0) {
      distribution.snapshotZero += 1;
      distribution.estimatedCount += 1;
      continue;
    }

    if (count === 1) {
      distribution.snapshotOne += 1;
      distribution.estimatedCount += 1;
      continue;
    }

    distribution.snapshotTwoOrMore += 1;

    const inPeriodCount = countSnapshotsInPeriod(snapshots, input.period, nowMs);
    if (inPeriodCount >= 2) {
      distribution.inPeriodSnapshotTwoOrMore += 1;
    }

    const latestSnapshot = snapshots.at(-1);
    const viewCount =
      input.viewCountByVideoId?.get(videoId) ??
      latestSnapshot?.view_count ??
      0;
    const publishedAt =
      input.publishedAtByVideoId?.get(videoId) ??
      latestSnapshot?.captured_at ??
      new Date().toISOString();

    const metricsInput = {
      period: input.period,
      viewCount,
      subscriberCount: input.subscriberCountByVideoId?.get(videoId) ?? 0,
      subscriberCountHidden: false,
      publishedAt,
      snapshots,
    };

    if (isEstimatedDespiteTwoOrMoreSnapshots(metricsInput)) {
      distribution.twoOrMoreButEstimated += 1;
      distribution.estimatedCount += 1;

      if (hasBaselineDriftFailure(metricsInput)) {
        distribution.insufficientDueToBaselineDrift += 1;
      }
      continue;
    }

    distribution.measuredCount += 1;
  }

  return distribution;
}
