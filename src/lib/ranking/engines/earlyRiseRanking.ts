import {
  buildEarlyRiseRankReason,
  calculateEarlyRiseScore,
  formatEarlyRiseSecondaryValue,
  isEarlyRiseEligible,
} from "@/lib/ranking/earlyRiseScore";
import {
  formatViewsPerHour,
  mapMeasuredVideos,
} from "@/lib/ranking/engines/buzzRanking";
import { RANKING_SCORE_NAMES } from "@/lib/ranking/rankingMeta";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import type { Video } from "@/types";

export function buildEarlyRiseRankingVideos(
  enriched: SnapshotEnrichedVideo[],
): Video[] {
  const measured = enriched.filter(isEarlyRiseEligible);

  return mapMeasuredVideos(
    measured,
    (entry) => {
      const metrics = entry.promotionMetrics!;
      const v1h = metrics.v1h ?? 0;
      const breakdown = calculateEarlyRiseScore(entry);

      return {
        scoreName: RANKING_SCORE_NAMES.early_rise,
        scoreValue: breakdown.score ?? 0,
        rankReason: buildEarlyRiseRankReason(entry),
        heroLabel: "1時間あたり再生速度",
        heroValue: `${formatViewsPerHour(v1h)}回/時`,
        secondaryLabel: "加速度",
        secondaryValue: formatEarlyRiseSecondaryValue(entry),
      };
    },
    (left, right) => {
      const leftScore = calculateEarlyRiseScore(left).score ?? 0;
      const rightScore = calculateEarlyRiseScore(right).score ?? 0;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (right.promotionMetrics!.v1h ?? 0) - (left.promotionMetrics!.v1h ?? 0);
    },
  );
}
