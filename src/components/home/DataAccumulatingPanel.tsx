import { StatePanel } from "@/components/ui/StatePanel";
import type { RankingReadiness } from "@/types/ranking";

interface DataAccumulatingPanelProps {
  title: string;
  description: string;
  readiness: RankingReadiness;
  onViewBuzz?: () => void;
}

export function DataAccumulatingPanel({
  title,
  description,
  readiness,
  onViewBuzz,
}: DataAccumulatingPanelProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-50 sm:text-2xl">{title}</h2>
        <p className="text-sm text-zinc-400 sm:text-base">{description}</p>
      </div>

      <StatePanel
        tone="empty"
        title="データ蓄積中"
        description={
          readiness.message ||
          "実測スナップショットが十分に集まるまで、このランキングは表示できません。"
        }
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400 sm:px-5">
        <p>
          現在の実測対象:{" "}
          <span className="font-semibold text-zinc-200">
            {readiness.eligibleCount}件
          </span>
          {" / "}
          必要件数:{" "}
          <span className="font-semibold text-zinc-200">
            {readiness.requiredCount}件以上
          </span>
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          24時間程度の計測が進むと、実測データに基づくランキングを表示できます。
        </p>
      </div>

      {onViewBuzz ? (
        <button
          type="button"
          onClick={onViewBuzz}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
        >
          バズ動画ランキングを見る
        </button>
      ) : null}
    </div>
  );
}
