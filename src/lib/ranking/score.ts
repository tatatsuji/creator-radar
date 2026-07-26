import { getPeriodHours } from "@/lib/ranking/periods";
import { isTopicChannelName } from "@/lib/youtube/filters";
import type { RankingPeriod } from "@/types";

// Typical trending raw scores land around 150-280; scale spreads 0-100 without saturating.
const RADAR_SCORE_SCALE = 300;
const MAX_RATIO_FOR_SCORE = 30;

export interface TrendingInputs {
  viewCount: number;
  subscriberCount: number;
  subscriberCountHidden: boolean;
  publishedAt: string;
  period: RankingPeriod;
  channelName?: string;
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
  const viewDelta =
    input.measuredViewDelta ?? Math.round(viewVelocity * effectiveHours);
  const viewsPerSubscriber =
    input.measuredViewsPerSubscriber ??
    (!input.subscriberCountHidden && input.subscriberCount > 0
      ? input.viewCount / input.subscriberCount
      : 0);

  const recencyRatio = Math.min(hoursSincePublish, periodHours) / periodHours;
  const recencyBoost = 1 - recencyRatio * 0.4;

  const velocityScore = Math.log10(viewVelocity + 1) * 45;
  const cappedRatio = Math.min(viewsPerSubscriber, MAX_RATIO_FOR_SCORE);
  const ratioScore = Math.log10(cappedRatio + 1) * 22;
  const recencyScore = recencyBoost * 20;
  const subscriberBoost =
    input.subscriberCountHidden || input.subscriberCount <= 0
      ? 0
      : Math.log10(input.subscriberCount + 1) * 6;

  let rawScore = velocityScore + ratioScore + recencyScore + subscriberBoost;

  if (input.channelName && isTopicChannelName(input.channelName)) {
    rawScore *= 0.85;
  }

  return {
    viewDelta,
    viewVelocity,
    viewsPerSubscriber,
    rawScore,
  };
}

export function computeRadarScore(rawScore: number): number {
  return Math.min(
    100,
    Math.max(0, Math.round((rawScore / RADAR_SCORE_SCALE) * 100)),
  );
}

export { getPeriodHours };
