import { getCardHeroMetric } from "@/lib/ranking/cardDisplay";
import {
  getVideoAnalysisInsight,
  RANKING_REFERENCE_EXPLANATION,
} from "@/lib/video/analysisDisplay";
import { getVideoDetailRankingContext } from "@/lib/video/detailContext";
import type { RankingPeriod, Video } from "@/types";
import type { RankingType } from "@/types/ranking";

interface VideoAnalysisInsightProps {
  video: Video;
  period: RankingPeriod;
  ranking?: RankingType;
}

export function VideoAnalysisInsight({
  video,
  period,
  ranking = "buzz",
}: VideoAnalysisInsightProps) {
  const insight = getVideoAnalysisInsight(video, period);
  const heroMetric = getCardHeroMetric(video, period);
  const rankingContext = getVideoDetailRankingContext(video, ranking, period);
  const isMeasured = video.metrics.metricsSource === "measured";

  return (
    <section
      className="glass-panel overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent p-4 sm:p-6"
      aria-labelledby="analysis-insight-heading"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
            数値で見る伸び
          </p>
          <h2
            id="analysis-insight-heading"
            className="text-lg font-bold leading-snug text-zinc-50 sm:text-xl"
          >
            {insight.headline}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">{insight.summary}</p>
          <p className="text-xs text-zinc-500">{insight.dataSourceNote}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
          <div
            className={`rounded-2xl border px-4 py-4 ${
              isMeasured
                ? "border-emerald-500/25 bg-emerald-500/10"
                : "border-violet-500/25 bg-violet-500/10"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isMeasured ? "text-emerald-300/90" : "text-violet-300/90"
              }`}
            >
              {heroMetric.label}
            </p>
            <p
              className={`mt-2 text-3xl font-bold tabular-nums sm:text-4xl ${
                isMeasured ? "text-emerald-100" : "text-violet-100"
              }`}
            >
              {heroMetric.value}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              この画面で最も重要な「現在の伸び方」指標です。将来予測ではなく、観測時点の値です。
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {rankingContext.scoreLabel}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-50">
              {rankingContext.scoreValue}
            </p>
            <p
              className="mt-2 text-xs leading-relaxed text-zinc-500"
              title={RANKING_REFERENCE_EXPLANATION}
            >
              {insight.rankingReference.note}
            </p>
          </div>
        </div>

        {insight.highlights.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {insight.highlights.map((highlight) => (
              <li
                key={highlight}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm leading-relaxed text-zinc-300"
              >
                {highlight}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
