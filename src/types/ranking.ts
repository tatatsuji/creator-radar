export const RANKING_TYPES = [
  "buzz",
  "early_rise",
  "launch_speed",
  "potential",
] as const;

export type RankingType = (typeof RANKING_TYPES)[number];

export type RankingDataStatus = "ready" | "accumulating";

export interface RankingDisplayInfo {
  scoreName: string;
  scoreValue: number | null;
  rankReason: string | null;
  heroLabel: string;
  heroValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
}

export interface RankingReadiness {
  status: RankingDataStatus;
  eligibleCount: number;
  requiredCount: number;
  message: string;
}

export const MIN_MEASURED_VIDEOS_FOR_SNAPSHOT_RANKING = 3;
export const MIN_SNAPSHOTS_FOR_EARLY_RISE = 2;
export const MIN_SNAPSHOTS_FOR_POTENTIAL = 3;

export function isRankingType(value: string): value is RankingType {
  return (RANKING_TYPES as readonly string[]).includes(value);
}
