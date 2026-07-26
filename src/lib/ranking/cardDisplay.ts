import { formatViewDelta } from "@/lib/format";
import {
  getVelocityDisplay,
  getVelocityLabel,
  ESTIMATED_VELOCITY_LABEL,
} from "@/lib/ranking/metrics";
import { getViewDeltaLabel } from "@/lib/ranking/periods";
import type { RankingPeriod, Video } from "@/types";

export const RADAR_SCORE_EXPLANATION =
  "再生速度・登録者比・新しさから算出（0〜100）";

export interface CardHeroMetric {
  label: string;
  value: string;
  isGrowthHighlight: boolean;
}

export interface CardScoreMetric {
  label: string;
  value: string;
  explanation?: string;
}

export function getCardHeroMetric(
  video: Video,
  period: RankingPeriod,
): CardHeroMetric {
  if (video.rankingDisplay) {
    return {
      label: video.rankingDisplay.heroLabel,
      value: video.rankingDisplay.heroValue,
      isGrowthHighlight: video.metrics.metricsSource === "measured",
    };
  }

  if (video.metrics.metricsSource === "measured") {
    return {
      label: getViewDeltaLabel(period),
      value: formatViewDelta(video.metrics.viewDelta),
      isGrowthHighlight: true,
    };
  }

  const velocity = getVelocityDisplay(video, period);

  return {
    label: ESTIMATED_VELOCITY_LABEL,
    value: `${velocity.value}${velocity.unit}`,
    isGrowthHighlight: true,
  };
}

export function getCardSecondaryVelocity(
  video: Video,
  period: RankingPeriod,
): { label: string; value: string } | null {
  if (video.rankingDisplay?.secondaryLabel && video.rankingDisplay.secondaryValue) {
    return {
      label: video.rankingDisplay.secondaryLabel,
      value: video.rankingDisplay.secondaryValue,
    };
  }

  if (video.metrics.metricsSource !== "measured") {
    return null;
  }

  const velocity = getVelocityDisplay(video, period);

  return {
    label: getVelocityLabel(video.metrics.metricsSource),
    value: `${velocity.value}${velocity.unit}`,
  };
}

export function getCardScoreMetric(video: Video): CardScoreMetric {
  if (video.rankingDisplay) {
    return {
      label: video.rankingDisplay.scoreName,
      value:
        video.rankingDisplay.scoreValue === null
          ? "-"
          : String(video.rankingDisplay.scoreValue),
    };
  }

  return {
    label: "ランキング参考値",
    value: String(Math.round(video.metrics.rankingScore)),
    explanation: RADAR_SCORE_EXPLANATION,
  };
}

export function getCardRankReason(video: Video): string | null {
  return video.rankingDisplay?.rankReason ?? null;
}
