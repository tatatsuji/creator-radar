import Link from "next/link";

import { buildHomeHref, type HomeUrlState } from "@/lib/home/urlState";
import { getVideoDetailRankingContext } from "@/lib/video/detailContext";
import type { RankingPeriod, Video } from "@/types";

interface VideoRankingContextProps {
  video: Video;
  period: RankingPeriod;
  homeUrlState: HomeUrlState;
}

export function VideoRankingContext({
  video,
  period,
  homeUrlState,
}: VideoRankingContextProps) {
  const context = getVideoDetailRankingContext(
    video,
    homeUrlState.ranking,
    period,
  );
  const rankingHref = buildHomeHref(homeUrlState);
  const exploreHref = buildHomeHref({
    ...homeUrlState,
    ranking: "buzz",
    period,
  });

  return (
    <section
      className="glass-panel overflow-hidden border-violet-500/25 bg-gradient-to-br from-violet-500/[0.12] via-violet-500/[0.04] to-transparent"
      aria-labelledby="ranking-context-heading"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
              {context.rankingTitle}
            </p>
            <p className="text-sm text-zinc-400">{context.oneLiner}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {context.scoreLabel}
            </p>
            <p className="text-xl font-bold tabular-nums text-zinc-50">
              {context.scoreValue}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h2
            id="ranking-context-heading"
            className="text-base font-semibold text-zinc-100 sm:text-lg"
          >
            {context.userQuestion}
          </h2>
          <p className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm leading-relaxed text-violet-50/95 sm:text-base">
            {context.whyHere}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
              ひとことで
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
              {context.takeaway}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
              明日また見る理由
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
              {context.revisitHint}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={rankingHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
          >
            {context.rankingLabel}一覧に戻る
          </Link>
          {homeUrlState.ranking !== "buzz" ? (
            <Link
              href={exploreHref}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06]"
            >
              バズ動画も見る
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
