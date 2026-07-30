import type {
  BuzzRankingAnalysis,
  EarlyRiseRankingAnalysis,
  RankingOptimizedAnalysis,
} from "@/lib/video/rankingAnalysis/types";

interface VideoBuzzAnalysisPanelProps {
  analysis: BuzzRankingAnalysis;
}

export function VideoBuzzAnalysisPanel({ analysis }: VideoBuzzAnalysisPanelProps) {
  const paragraphs = analysis.whyTrendingNow
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <section
      className="glass-panel overflow-hidden border-sky-500/25 bg-gradient-to-br from-sky-500/[0.10] via-transparent to-violet-500/[0.06]"
      aria-labelledby="buzz-analysis-heading"
    >
      <div className="space-y-5 p-4 sm:p-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/90">
            バズ動画の読み解き
          </p>
          <h2
            id="buzz-analysis-heading"
            className="text-lg font-bold text-zinc-50 sm:text-xl"
          >
            なぜ今、話題になっている？
          </h2>
          <p className="text-sm text-zinc-400">{analysis.overview}</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            いまの勢い
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-50 sm:text-3xl">
            {analysis.momentumValue}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{analysis.momentumLabel}</p>
        </div>

        <div className="space-y-3">
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="text-sm leading-relaxed text-zinc-200 sm:text-base"
            >
              {paragraph}
            </p>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">{analysis.disclaimer}</p>
      </div>
    </section>
  );
}

interface VideoEarlyRiseAnalysisPanelProps {
  analysis: EarlyRiseRankingAnalysis;
}

export function VideoEarlyRiseAnalysisPanel({
  analysis,
}: VideoEarlyRiseAnalysisPanelProps) {
  return (
    <section
      className="glass-panel space-y-5 p-4 sm:p-6"
      aria-labelledby="early-rise-analysis-heading"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
          伸び始めの分析
        </p>
        <h2
          id="early-rise-analysis-heading"
          className="text-lg font-bold text-zinc-50 sm:text-xl"
        >
          なぜ伸び始めた？
        </h2>
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm leading-relaxed text-zinc-200">
          {analysis.summary}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-100">① 事実</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {analysis.facts.map((fact) => (
            <li
              key={fact.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {fact.label}
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-200">{fact.value}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-100">② 考えられる理由</h3>
        <ul className="space-y-2">
          {analysis.hypotheses.map((item) => (
            <li
              key={item.text}
              className="rounded-xl border border-violet-500/15 bg-violet-500/[0.05] px-4 py-3 text-sm leading-relaxed text-zinc-300"
            >
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-100">③ 参考になるポイント</h3>
        <ul className="space-y-2">
          {analysis.referencePoints.map((item) => (
            <li
              key={item.text}
              className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 text-sm leading-relaxed text-zinc-300"
            >
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">{analysis.disclaimer}</p>
    </section>
  );
}

interface VideoDetailAnalysisProps {
  analysis: RankingOptimizedAnalysis;
}

export function VideoDetailAnalysis({ analysis }: VideoDetailAnalysisProps) {
  if (analysis.kind === "buzz") {
    return <VideoBuzzAnalysisPanel analysis={analysis} />;
  }

  return <VideoEarlyRiseAnalysisPanel analysis={analysis} />;
}
