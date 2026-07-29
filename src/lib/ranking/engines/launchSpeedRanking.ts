import { PROMOTION_CONFIG } from "@/lib/promotion/config";
import {
  formatViewsPerHour,
  mapMeasuredVideos,
} from "@/lib/ranking/engines/buzzRanking";
import { RANKING_SCORE_NAMES } from "@/lib/ranking/rankingMeta";
import {
  getPublishedAgeHours,
  type SnapshotEnrichedVideo,
} from "@/lib/ranking/snapshotRankingBase";
import type { Video } from "@/types";

function computeLaunchSpeedScore(entry: SnapshotEnrichedVideo): number {
  const metrics = entry.promotionMetrics!;
  const v1h = metrics.v1h ?? 0;
  const ageHours = getPublishedAgeHours(entry.video.publishedAt);
  const ageBoost = Math.max(
    PROMOTION_CONFIG.thresholds.earlyDiscoveryBoostHours - ageHours,
    0,
  );

  return Math.round(Math.log10(v1h + 1) * 50 + ageBoost);
}

export function buildLaunchSpeedRankingVideos(
  enriched: SnapshotEnrichedVideo[],
): Video[] {
  const maxAgeHours = PROMOTION_CONFIG.thresholds.earlyDiscoveryBoostHours;

  const measured = enriched.filter((entry) => {
    const metrics = entry.promotionMetrics;
    if (!metrics || metrics.snapshotQuality !== "measured" || metrics.v1h === null) {
      return false;
    }

    return getPublishedAgeHours(entry.video.publishedAt) <= maxAgeHours;
  });

  return mapMeasuredVideos(
    measured,
    (entry) => {
      const metrics = entry.promotionMetrics!;
      const v1h = metrics.v1h ?? 0;
      const ageHours = getPublishedAgeHours(entry.video.publishedAt);
      const ageLabel =
        ageHours < 24
          ? `${Math.round(ageHours)}時間`
          : `${Math.round(ageHours / 24)}日`;

      return {
        scoreName: RANKING_SCORE_NAMES.launch_speed,
        scoreValue: computeLaunchSpeedScore(entry),
        rankReason: `公開${ageLabel} · ${formatViewsPerHour(v1h)}回/時（実測）`,
        heroLabel: "1時間あたり再生速度",
        heroValue: `${formatViewsPerHour(v1h)}回/時`,
        secondaryLabel: "公開から",
        secondaryValue: ageLabel,
      };
    },
    (left, right) => {
      const leftScore = computeLaunchSpeedScore(left);
      const rightScore = computeLaunchSpeedScore(right);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (right.promotionMetrics!.v1h ?? 0) - (left.promotionMetrics!.v1h ?? 0);
    },
  );
}
