import { buildBuzzRankingVideos } from "@/lib/ranking/engines/buzzRanking";
import { buildEarlyRiseRankingVideos } from "@/lib/ranking/engines/earlyRiseRanking";
import { buildLaunchSpeedRankingVideos } from "@/lib/ranking/engines/launchSpeedRanking";
import { buildPotentialRankingVideos } from "@/lib/ranking/engines/potentialRanking";
import { buildSubscriberRatioRankingVideos } from "@/lib/ranking/engines/subscriberRatioRanking";
import { countEarlyRiseEligible } from "@/lib/ranking/earlyRiseScore";
import { countPotentialEligible } from "@/lib/ranking/potentialScore";
import { MIN_BUZZ_RANKING_TARGET, RANKING_ACCUMULATING_MESSAGES } from "@/lib/ranking/rankingMeta";
import { getBuzzRankingFallbackCandidates } from "@/lib/ranking/buzzRankingFallback";
import { getSnapshotMetricsSummary } from "@/lib/ranking/snapshotMetrics";
import {
  enrichVideosWithSnapshots,
  getBuzzRankingCandidatesFromDb,
  getMeasuredPromotionVideos,
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

function countEligibleVideos(
  ranking: RankingType,
  enriched: SnapshotEnrichedVideo[],
): number {
  switch (ranking) {
    case "early_rise":
      return countEarlyRiseEligible(enriched);
    case "potential":
      return countPotentialEligible(enriched);
    case "launch_speed":
      return getMeasuredPromotionVideos(enriched).length;
    default:
      return 0;
  }
}

function assessReadiness(
  ranking: RankingType,
  enriched: SnapshotEnrichedVideo[],
  totalCount: number,
): RankingReadiness {
  if (ranking === "buzz") {
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

  const eligibleCount = countEligibleVideos(ranking, enriched);

  if (eligibleCount < MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING) {
    return {
      status: "accumulating",
      eligibleCount,
      requiredCount: MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING,
      message: RANKING_ACCUMULATING_MESSAGES[ranking],
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
      readiness: assessReadiness(ranking, [], candidates.length),
      metricsSummary: getSnapshotMetricsSummary(videos),
      usedYouTubeFallback,
    };
  }

  if (ranking === "subscriber_ratio") {
    const dbCandidates = await getBuzzRankingCandidatesFromDb(period, genre);
    let usedYouTubeFallback = false;
    let candidates = dbCandidates;

    if (candidates.length === 0) {
      usedYouTubeFallback = true;
      candidates = await getBuzzRankingFallbackCandidates(period, genre);
    }

    const videos = await buildSubscriberRatioRankingVideos(candidates, period);
    return {
      ranking,
      videos,
      readiness: assessReadiness("buzz", [], candidates.length),
      metricsSummary: getSnapshotMetricsSummary(videos),
      usedYouTubeFallback,
    };
  }

  const candidates = await getMeasuredRankingCandidates(period, genre);
  const enriched = await enrichVideosWithSnapshots(candidates);
  const readiness = assessReadiness(ranking, enriched, candidates.length);

  if (readiness.status === "accumulating") {
    return {
      ranking,
      videos: [],
      readiness,
      metricsSummary: {
        measured: countEligibleVideos(ranking, enriched),
        estimated: 0,
      },
    };
  }

  let videos: Video[] = [];

  switch (ranking) {
    case "early_rise":
      videos = buildEarlyRiseRankingVideos(enriched);
      break;
    case "launch_speed":
      videos = buildLaunchSpeedRankingVideos(enriched);
      break;
    case "potential":
      videos = buildPotentialRankingVideos(enriched);
      break;
    default:
      videos = [];
  }

  return {
    ranking,
    videos,
    readiness,
    metricsSummary: getSnapshotMetricsSummary(videos),
  };
}
