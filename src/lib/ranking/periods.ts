import type { RankingPeriod } from "@/types";

export interface RankingPeriodConfig {
  id: RankingPeriod;
  label: string;
  hours: number;
}

export const RANKING_PERIODS: RankingPeriodConfig[] = [
  { id: "24h", label: "24時間", hours: 24 },
  { id: "3d", label: "3日間", hours: 72 },
  { id: "7d", label: "7日間", hours: 168 },
  { id: "30d", label: "30日間", hours: 720 },
];

const PERIOD_MAP = new Map(RANKING_PERIODS.map((period) => [period.id, period]));

export function getPeriodHours(period: RankingPeriod): number {
  return PERIOD_MAP.get(period)?.hours ?? 24;
}

export function getPeriodLabel(period: RankingPeriod): string {
  return PERIOD_MAP.get(period)?.label ?? "24時間";
}

export function getPeriodHeadline(period: RankingPeriod): string {
  switch (period) {
    case "24h":
      return "今日、最も伸びている動画";
    case "3d":
      return "3日間で最も伸びている動画";
    case "7d":
      return "7日間で最も伸びている動画";
    case "30d":
      return "30日間で最も伸びている動画";
    default:
      return "最も伸びている動画";
  }
}

export function getViewDeltaLabel(period: RankingPeriod): string {
  switch (period) {
    case "24h":
      return "24時間の伸び";
    case "3d":
      return "3日間の伸び";
    case "7d":
      return "7日間の伸び";
    case "30d":
      return "30日間の伸び";
    default:
      return "期間内の伸び";
  }
}

export function getPublishedAfter(period: RankingPeriod, now = new Date()): string {
  const date = new Date(now);
  date.setHours(date.getHours() - getPeriodHours(period));
  return date.toISOString();
}

export function parseRankingPeriod(value?: string | null): RankingPeriod {
  if (value && PERIOD_MAP.has(value as RankingPeriod)) {
    return value as RankingPeriod;
  }

  return "24h";
}

export function isRankingPeriod(value: string): value is RankingPeriod {
  return PERIOD_MAP.has(value as RankingPeriod);
}
