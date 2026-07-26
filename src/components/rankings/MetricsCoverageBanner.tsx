import { formatMetricsCoverageLine } from "@/lib/ranking/coverageDisplay";
import { formatRankingUpdatedAt } from "@/lib/format";

interface MetricsCoverageBannerProps {
  measured: number;
  estimated: number;
  total: number;
  updatedAt: string;
  dataFreshnessAt?: string | null;
}

export function MetricsCoverageBanner({
  measured,
  estimated,
  total,
  updatedAt,
  dataFreshnessAt = null,
}: MetricsCoverageBannerProps) {
  const summary = { measured, estimated, total };
  const freshnessTarget = dataFreshnessAt ?? updatedAt;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-300">
          {formatMetricsCoverageLine(summary)}
        </p>
        <p className="text-xs text-zinc-500">
          最終更新 {formatRankingUpdatedAt(freshnessTarget)}
        </p>
      </div>
      {measured === 0 && total > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          計測データが増えると「推定」から「実測」に切り替わります。しばらくお待ちください。
        </p>
      ) : measured > 0 && estimated > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          実測は定期取得したデータ、推定は公開情報から算出した参考値です。
        </p>
      ) : null}
    </div>
  );
}
