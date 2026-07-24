import type { RankingPeriod } from "@/types";

export function getPeriodHours(period: RankingPeriod): number {
  if (period === "24h") {
    return 24;
  }
  if (period === "3d") {
    return 72;
  }
  return 168;
}

export interface TrendingInputs {
  viewCount: number;
  subscriberCount: number;
  subscriberCountHidden: boolean;
  publishedAt: string;
  period: RankingPeriod;
  measuredViewDelta?: number;
  measuredViewVelocity?: number;
  measuredViewsPerSubscriber?: number;
}

export interface TrendingRawMetrics {
  viewDelta: number;
  viewVelocity: number;
  viewsPerSubscriber: number;
  rawScore: number;
}

export function computeRawTrendingMetrics(
  input: TrendingInputs,
): TrendingRawMetrics {
  const periodHours = getPeriodHours(input.period);
  const hoursSincePublish = Math.max(
    (Date.now() - new Date(input.publishedAt).getTime()) / (1000 * 60 * 60),
    1,
  );
  const effectiveHours = Math.min(hoursSincePublish, periodHours);
  const viewVelocity =
    input.measuredViewVelocity ?? input.viewCount / effectiveHours;
  const viewDelta = input.measuredViewDelta ?? input.viewCount;
  const viewsPerSubscriber =
    input.measuredViewsPerSubscriber ??
    (!input.subscriberCountHidden && input.subscriberCount > 0
      ? input.viewCount / input.subscriberCount
      : 0);

  const recencyRatio = Math.min(hoursSincePublish, periodHours) / periodHours;
  const recencyBoost = 1 - recencyRatio * 0.4;

  const velocityScore = Math.log10(viewVelocity + 1) * 42;
  const ratioScore = Math.log10(viewsPerSubscriber + 1) * 38;
  const recencyScore = recencyBoost * 20;
  const rawScore = velocityScore + ratioScore + recencyScore;

  return {
    viewDelta,
    viewVelocity,
    viewsPerSubscriber,
    rawScore,
  };
}

export function normalizeTrendingScores(rawScores: number[]): number[] {
  if (rawScores.length === 0) {
    return [];
  }

  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);

  if (max === min) {
    return rawScores.map(() => 50);
  }

  return rawScores.map((score) => {
    const normalized = ((score - min) / (max - min)) * 100;
    return Math.round(Math.min(100, Math.max(0, normalized)));
  });
}
