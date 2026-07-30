import type { PromotionMetrics } from "@/lib/promotion/metrics";
import type { RankingPeriod, Video } from "@/types";
import type { HomeUiRankingType } from "@/types/ranking";

export interface VideoEngagementStats {
  likeCount: number | null;
  commentCount: number | null;
  likeRate: number | null;
  commentRate: number | null;
}

export interface VideoAnalysisInput {
  video: Video;
  period: RankingPeriod;
  engagement: VideoEngagementStats;
  promotionMetrics: PromotionMetrics | null;
}

export interface BuzzRankingAnalysis {
  kind: "buzz";
  /** 5秒で伝わる一言 */
  leadAnswer: string;
  momentumLabel: string;
  momentumValue: string;
  /** 折りたたみ内の補足 */
  details: string[];
  disclaimer: string;
  provider: AnalysisProvider;
}

export interface AnalysisFact {
  id: string;
  label: string;
  value: string;
}

export interface AnalysisHypothesis {
  text: string;
}

export interface EarlyRiseRankingAnalysis {
  kind: "early_rise";
  summary: string;
  facts: AnalysisFact[];
  hypotheses: AnalysisHypothesis[];
  disclaimer: string;
  provider: AnalysisProvider;
}

export type RankingOptimizedAnalysis =
  | BuzzRankingAnalysis
  | EarlyRiseRankingAnalysis;

export type AnalysisProvider = "rule_based" | "openai";

export type RankingAnalysisRanking = HomeUiRankingType;
