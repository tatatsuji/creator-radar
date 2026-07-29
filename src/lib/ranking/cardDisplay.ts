import { formatViewDelta } from "@/lib/format";
import {
  getVelocityDisplay,
  getVelocityLabel,
  ESTIMATED_VELOCITY_LABEL,
} from "@/lib/ranking/metrics";
import { getViewDeltaLabel } from "@/lib/ranking/periods";
import { RANKING_TYPE_WHY_PREFIX } from "@/lib/ranking/rankingMeta";
import type { RankingPeriod, Video } from "@/types";
import type { RankingType } from "@/types/ranking";

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

const CONTENT_KIND_LABELS: Record<NonNullable<Video["contentKind"]>, string> = {
  short: "Shorts",
  live: "ライブ",
  regular: "通常動画",
  unknown: "動画",
};

/**
 * Short user-facing explanation of why the video ranks here (DB data only).
 */
export function getCardTrendInsight(
  video: Video,
  ranking: RankingType,
  period: RankingPeriod,
): string {
  const prefix = RANKING_TYPE_WHY_PREFIX[ranking];
  const kindLabel =
    video.contentKind && video.contentKind !== "unknown"
      ? CONTENT_KIND_LABELS[video.contentKind]
      : null;

  if (video.rankingDisplay?.rankReason) {
    const base = video.rankingDisplay.rankReason;
    return kindLabel ? `${prefix}: ${base}（${kindLabel}）` : `${prefix}: ${base}`;
  }

  if (video.metrics.metricsSource === "measured") {
    const delta = formatViewDelta(video.metrics.viewDelta);
    const label = getViewDeltaLabel(period);
    return kindLabel
      ? `${prefix}: ${label}${delta}の実測増加（${kindLabel}）`
      : `${prefix}: ${label}${delta}の実測増加`;
  }

  const velocity = getVelocityDisplay(video, period);
  const velocityText = `${velocity.value}${velocity.unit}`;
  return kindLabel
    ? `${prefix}: 公開後平均${velocityText}（${kindLabel}・推定）`
    : `${prefix}: 公開後平均${velocityText}（推定）`;
}
