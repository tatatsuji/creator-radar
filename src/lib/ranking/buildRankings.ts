import { buildBuzzRankingVideos } from "@/lib/ranking/engines/buzzRanking";
import { buildEarlyRiseRankingVideos } from "@/lib/ranking/engines/earlyRiseRanking";
import { countEarlyRiseEligible } from "@/lib/ranking/earlyRiseScore";
import { MIN_BUZZ_RANKING_TARGET, RANKING_ACCUMULATING_MESSAGES } from "@/lib/ranking/rankingMeta";
import { getBuzzRankingFallbackCandidates } from "@/lib/ranking/buzzRankingFallback";
import { getSnapshotMetricsSummary } from "@/lib/ranking/snapshotMetrics";
import {
  enrichVideosWithSnapshots,
  getBuzzRankingCandidatesFromDb,
  getMeasuredRankingCandidates,
  type SnapshotEnrichedVideo,
} from "@/lib/ranking/snapshotRankingBase";
import type { GenreId, RankingPeriod, Video } from "@/types";
import {
  MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING,
  type RankingReadiness,
  type RankingType,
} from "@/types/ranking";

export interface BuiltRankingsResult {
  ranking: RankingType;
  videos: Video[];
  readiness: RankingReadiness;
  metricsSummary: { measured: number; estimated: number };
  usedYouTubeFallback?: boolean;
}

function countEligibleVideos(enriched: SnapshotEnrichedVideo[]): number {
  return countEarlyRiseEligible(enriched);
}

function assessBuzzReadiness(totalCount: number): RankingReadiness {
  return {
    status: "ready",
    eligibleCount: totalCount,
    requiredCount: MIN_BUZZ_RANKING_TARGET,
    message:
      totalCount < MIN_BUZZ_RANKING_TARGET
        ? `条件を満たす動画が${totalCount}件です（目標${MIN_BUZZ_RANKING_TARGET}件）。品質条件は緩めていません。`
        : "",
  };
}

function assessEarlyRiseReadiness(
  enriched: SnapshotEnrichedVideo[],
  totalCount: number,
): RankingReadiness {
  const eligibleCount = countEligibleVideos(enriched);

  if (eligibleCount < MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING) {
    return {
      status: "accumulating",
      eligibleCount,
      requiredCount: MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING,
      message: RANKING_ACCUMULATING_MESSAGES.early_rise,
    };
  }

  return {
    status: "ready",
    eligibleCount,
    requiredCount: MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING,
    message: "",
  };
}

export async function buildRankings(
  ranking: RankingType,
  period: RankingPeriod,
  genre: GenreId,
): Promise<BuiltRankingsResult> {
  if (ranking === "buzz") {
    const dbCandidates = await getBuzzRankingCandidatesFromDb(period, genre);
    let usedYouTubeFallback = false;
    let candidates = dbCandidates;

    if (candidates.length === 0) {
      usedYouTubeFallback = true;
      candidates = await getBuzzRankingFallbackCandidates(period, genre);
    }

    const videos = await buildBuzzRankingVideos(candidates, period);
    return {
      ranking,
      videos,
      readiness: assessBuzzReadiness(candidates.length),
      metricsSummary: getSnapshotMetricsSummary(videos),
      usedYouTubeFallback,
    };
  }

  const candidates = await getMeasuredRankingCandidates(period, genre);
  const enriched = await enrichVideosWithSnapshots(candidates);
  const readiness = assessEarlyRiseReadiness(enriched, candidates.length);

  if (readiness.status === "accumulating") {
    return {
      ranking,
      videos: [],
      readiness,
      metricsSummary: {
        measured: countEligibleVideos(enriched),
        estimated: 0,
      },
    };
  }

  const videos = buildEarlyRiseRankingVideos(enriched);

  return {
    ranking,
    videos,
    readiness,
    metricsSummary: getSnapshotMetricsSummary(videos),
  };
}
