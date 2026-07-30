import type { HomeUiRankingType } from "@/types/ranking";

import { buildBuzzRankingAnalysis } from "./buzzAnalysis";
import { buildEarlyRiseRankingAnalysis } from "./earlyRiseAnalysis";
import type { RankingOptimizedAnalysis, VideoAnalysisInput } from "./types";

export { buildVideoAnalysisInput } from "./buildInput";
export type {
  BuzzRankingAnalysis,
  EarlyRiseRankingAnalysis,
  RankingOptimizedAnalysis,
  VideoAnalysisInput,
} from "./types";

export function getRankingOptimizedAnalysis(
  input: VideoAnalysisInput,
  ranking: HomeUiRankingType,
): RankingOptimizedAnalysis {
  if (ranking === "early_rise") {
    return buildEarlyRiseRankingAnalysis(input);
  }

  return buildBuzzRankingAnalysis(input);
}

export function getAnalysisCacheKey(
  input: VideoAnalysisInput,
  ranking: HomeUiRankingType,
): string {
  const { video } = input;
  const metricsKey = [
    video.metrics.viewDelta,
    video.metrics.viewVelocity,
    video.metrics.rankingScore,
    video.metrics.metricsSource,
  ].join(":");

  return `ranking-analysis:${video.id}:${ranking}:${input.period}:${metricsKey}`;
}
