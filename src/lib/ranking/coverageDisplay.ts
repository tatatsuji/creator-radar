import { getSnapshotMetricsSummary } from "@/lib/ranking/snapshotMetrics";
import type { Video } from "@/types";

export interface MetricsCoverageSummary {
  measured: number;
  estimated: number;
  total: number;
}

export function buildMetricsCoverageSummary(
  videos: Video[],
): MetricsCoverageSummary {
  const summary = getSnapshotMetricsSummary(videos);

  return {
    ...summary,
    total: videos.length,
  };
}

export function formatMetricsCoverageLine(
  summary: MetricsCoverageSummary,
): string {
  if (summary.total === 0) {
    return "実測データ: 対象動画なし";
  }

  const coveragePercent = Math.round((summary.measured / summary.total) * 100);

  return `実測 ${summary.measured}件 · 推定 ${summary.estimated}件 · カバレッジ ${coveragePercent}%`;
}
