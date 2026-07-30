import { VideoActionableTakeaways } from "@/components/video/VideoActionableTakeaways";
import { VideoCollapsibleSection } from "@/components/video/VideoCollapsibleSection";
import type {
  BuzzRankingAnalysis,
  EarlyRiseRankingAnalysis,
  RankingOptimizedAnalysis,
} from "@/lib/video/rankingAnalysis/types";
import type { Video } from "@/types";

interface VideoBuzzAnalysisPanelProps {
  analysis: BuzzRankingAnalysis;
}

export function VideoBuzzAnalysisPanel({ analysis }: VideoBuzzAnalysisPanelProps) {
  return (
    <section
      className="glass-panel overflow-hidden border-sky-500/25 bg-gradient-to-br from-sky-500/[0.10] via-transparent to-violet-500/[0.06]"
      aria-labelledby="buzz-analysis-heading"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/90">
            いま話題の理由
          </p>
          <h2
            id="buzz-analysis-heading"
            className="text-lg font-bold text-zinc-50 sm:text-xl"
          >
            なぜ今、注目されている？
          </h2>
          <p className="text-base leading-relaxed text-zinc-100 sm:text-lg">
            {analysis.leadAnswer}
          </p>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            いまの勢い
          </p>
          <p className="text-xl font-bold tabular-nums text-zinc-50">
            {analysis.momentumValue}
          </p>
          <p className="text-sm text-zinc-400">{analysis.momentumLabel}</p>
        </div>

        {analysis.details.length > 0 ? (
          <VideoCollapsibleSection
            title="もう少し詳しく"
            description="背景の補足情報"
          >
            <ul className="space-y-2">
              {analysis.details.map((detail) => (
                <li
                  key={detail}
                  className="text-sm leading-relaxed text-zinc-300"
                >
                  {detail}
                </li>
              ))}
            </ul>
          </VideoCollapsibleSection>
        ) : null}

        <p className="text-xs text-zinc-500">{analysis.disclaimer}</p>
      </div>
    </section>
  );
}

interface VideoEarlyRiseAnalysisPanelProps {
  analysis: EarlyRiseRankingAnalysis;
  video: Video;
}

export function VideoEarlyRiseAnalysisPanel({
  analysis,
  video,
}: VideoEarlyRiseAnalysisPanelProps) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <section
        className="glass-panel overflow-hidden border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.10] via-transparent to-violet-500/[0.04]"
        aria-labelledby="early-rise-analysis-heading"
      >
        <div className="space-y-3 p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
            伸び始めの要点
          </p>
          <h2
            id="early-rise-analysis-heading"
            className="text-lg font-bold text-zinc-50 sm:text-xl"
          >
            なぜ伸び始めた？
          </h2>
          <p className="text-base leading-relaxed text-zinc-100 sm:text-lg">
            {analysis.summary}
          </p>
          <ul className="flex flex-wrap gap-2 pt-1">
            {analysis.facts.map((fact) => (
              <li
                key={fact.id}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
              >
                <span className="text-zinc-500">{fact.label}: </span>
                {fact.value}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <VideoActionableTakeaways video={video} variant="prominent" />

      {analysis.hypotheses.length > 0 ? (
        <VideoCollapsibleSection
          title="考えられる理由"
          description="データから読み取れる推測（断定ではありません）"
        >
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
          <p className="mt-3 text-xs text-zinc-500">{analysis.disclaimer}</p>
        </VideoCollapsibleSection>
      ) : null}
    </div>
  );
}

interface VideoDetailAnalysisProps {
  analysis: RankingOptimizedAnalysis;
  video: Video;
}

export function VideoDetailAnalysis({ analysis, video }: VideoDetailAnalysisProps) {
  if (analysis.kind === "buzz") {
    return <VideoBuzzAnalysisPanel analysis={analysis} />;
  }

  return <VideoEarlyRiseAnalysisPanel analysis={analysis} video={video} />;
}
