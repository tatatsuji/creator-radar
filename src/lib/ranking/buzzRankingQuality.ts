import { getPublishedAfter } from "@/lib/ranking/periods";
import {
  BUZZ_CANDIDATE_POOL_SIZE,
  MAX_BUZZ_RANKING_RESULTS,
  MAX_BUZZ_VIDEOS_PER_CHANNEL,
} from "@/lib/ranking/rankingMeta";
import type { RankingPeriod, Video } from "@/types";

export function isWithinRankingPeriod(
  publishedAt: string,
  period: RankingPeriod,
  nowMs: number = Date.now(),
): boolean {
  const cutoffMs = new Date(getPublishedAfter(period)).getTime();
  return Date.parse(publishedAt) >= cutoffMs && Date.parse(publishedAt) <= nowMs;
}

export function passesBuzzQualityGate(
  video: Video,
  period: RankingPeriod,
  nowMs: number = Date.now(),
): boolean {
  if (!isWithinRankingPeriod(video.publishedAt, period, nowMs)) {
    return false;
  }

  if (video.metrics.rankingScore <= 0) {
    return false;
  }

  if (video.metrics.viewVelocity <= 0) {
    return false;
  }

  return true;
}

export function compareBuzzRankedVideos(left: Video, right: Video): number {
  const measuredDiff =
    (right.metrics.metricsSource === "measured" ? 1 : 0) -
    (left.metrics.metricsSource === "measured" ? 1 : 0);
  if (measuredDiff !== 0) {
    return measuredDiff;
  }

  const scoreDiff = right.metrics.rankingScore - left.metrics.rankingScore;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return right.metrics.viewVelocity - left.metrics.viewVelocity;
}

export function applyBuzzChannelCap(
  videos: Video[],
  maxPerChannel: number = MAX_BUZZ_VIDEOS_PER_CHANNEL,
  maxTotal: number = MAX_BUZZ_RANKING_RESULTS,
): Video[] {
  const channelCounts = new Map<string, number>();
  const selected: Video[] = [];

  for (const video of videos) {
    if (selected.length >= maxTotal) {
      break;
    }

    const channelId = video.channel.id;
    if (!channelId) {
      continue;
    }

    const currentCount = channelCounts.get(channelId) ?? 0;
    if (currentCount >= maxPerChannel) {
      continue;
    }

    channelCounts.set(channelId, currentCount + 1);
    selected.push(video);
  }

  return selected;
}

export function finalizeBuzzRankingList(
  rankedVideos: Video[],
  period: RankingPeriod,
  nowMs: number = Date.now(),
): Video[] {
  const qualityPassed = rankedVideos.filter((video) =>
    passesBuzzQualityGate(video, period, nowMs),
  );

  const sorted = [...qualityPassed].sort(compareBuzzRankedVideos);
  return applyBuzzChannelCap(sorted);
}

export function getBuzzCandidatePoolSize(): number {
  return BUZZ_CANDIDATE_POOL_SIZE;
}

export interface BuzzTop100AuditMetrics {
  displayCount: number;
  measuredCount: number;
  estimatedCount: number;
  measuredRate: number;
  uniqueChannelCount: number;
  scoreZeroCount: number;
  nonPositiveVelocityCount: number;
  categoryDistribution: Record<string, number>;
  classificationDistribution: Record<string, number>;
}

export function auditBuzzTop100(videos: Video[]): BuzzTop100AuditMetrics {
  const top100 = videos.slice(0, MAX_BUZZ_RANKING_RESULTS);
  const measuredCount = top100.filter(
    (video) => video.metrics.metricsSource === "measured",
  ).length;
  const estimatedCount = top100.length - measuredCount;

  const categoryDistribution: Record<string, number> = {};
  const classificationDistribution: Record<string, number> = {};

  for (const video of top100) {
    const categoryKey = video.categoryId ?? "unknown";
    categoryDistribution[categoryKey] = (categoryDistribution[categoryKey] ?? 0) + 1;

    const kind = video.contentKind ?? "unknown";
    classificationDistribution[kind] =
      (classificationDistribution[kind] ?? 0) + 1;
  }

  return {
    displayCount: top100.length,
    measuredCount,
    estimatedCount,
    measuredRate:
      top100.length > 0 ? measuredCount / top100.length : 0,
    uniqueChannelCount: new Set(top100.map((video) => video.channel.id)).size,
    scoreZeroCount: top100.filter((video) => video.metrics.rankingScore <= 0).length,
    nonPositiveVelocityCount: top100.filter(
      (video) => video.metrics.viewVelocity <= 0,
    ).length,
    categoryDistribution,
    classificationDistribution,
  };
}
