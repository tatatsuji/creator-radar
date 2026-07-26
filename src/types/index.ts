import type { GenreId, RankingPeriod } from "./observability";
import type { RankingDisplayInfo } from "./ranking";

export type { GenreId, RankingPeriod };
export type { RankingDisplayInfo, RankingType } from "./ranking";

export interface Genre {
  id: GenreId;
  label: string;
}

export interface Channel {
  id: string;
  name: string;
  subscriberCount: number;
  subscriberCountHidden?: boolean;
  thumbnailUrl?: string;
}

export type MetricsSource = "measured" | "estimated";

export interface VideoMetrics {
  period: RankingPeriod;
  viewDelta: number;
  viewVelocity: number;
  viewsPerSubscriber: number;
  rankingScore: number;
  metricsSource?: MetricsSource;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  publishedAt: string;
  channel: Channel;
  viewCount: number;
  metrics: VideoMetrics;
  rankingDisplay?: RankingDisplayInfo;
  durationSeconds?: number;
}

export interface RankingItem {
  rank: number;
  video: Video;
  metrics: VideoMetrics;
}

export interface RankingResponse {
  period: RankingPeriod;
  genre: GenreId;
  updatedAt: string;
  items: RankingItem[];
  total: number;
}

export interface AiAnalysis {
  summary: string;
  whyTrending: string[];
  targetAudience?: string;
  contentTags?: string[];
  generatedAt: string;
  isDummy: true;
}

export interface VideoDetail extends Video {
  metricsByPeriod: Record<RankingPeriod, VideoMetrics>;
  aiAnalysis: AiAnalysis;
}
