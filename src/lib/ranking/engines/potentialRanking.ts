import {
  buildPotentialRankReason,
  calculatePotentialScore,
  isPotentialEligible,
} from "@/lib/ranking/potentialScore";
import {
  formatViewsPerHour,
  mapMeasuredVideos,
} from "@/lib/ranking/engines/buzzRanking";
import { RANKING_SCORE_NAMES } from "@/lib/ranking/rankingMeta";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import type { Video } from "@/types";

export function buildPotentialRankingVideos(
  enriched: SnapshotEnrichedVideo[],
): Video[] {
  const pool = enriched.filter(isPotentialEligible);
  const measured = pool.filter((entry) => calculatePotentialScore(entry, pool).score !== null);

  return mapMeasuredVideos(
    measured,
    (entry) => {
      const metrics = entry.promotionMetrics!;
      const v1h = metrics.v1h ?? 0;
      const breakdown = calculatePotentialScore(entry, pool);

      return {
        scoreName: RANKING_SCORE_NAMES.potential,
        scoreValue: breakdown.score ?? 0,
        rankReason: buildPotentialRankReason(entry, pool),
        heroLabel: RANKING_SCORE_NAMES.potential,
        heroValue: String(breakdown.score ?? 0),
        secondaryLabel: "1時間あたり再生速度",
        secondaryValue: `${formatViewsPerHour(v1h)}回/時`,
      };
    },
    (left, right) => {
      const leftScore = calculatePotentialScore(left, pool).score ?? 0;
      const rightScore = calculatePotentialScore(right, pool).score ?? 0;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return (right.promotionMetrics!.v1h ?? 0) - (left.promotionMetrics!.v1h ?? 0);
    },
  );
}
