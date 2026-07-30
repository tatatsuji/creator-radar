import Link from "next/link";

import {
  formatCount,
  formatRelativePublishedAt,
} from "@/lib/format";
import {
  getCardHeroMetric,
  getCardScoreMetric,
  getCardSecondaryVelocity,
  getCardTrendInsight,
  RADAR_SCORE_EXPLANATION,
} from "@/lib/ranking/cardDisplay";
import { buildVideoDetailHref, type HomeUrlState } from "@/lib/home/urlState";
import { MetricsSourceBadge } from "@/components/ui/MetricsSourceBadge";
import { RemoteImage } from "@/components/ui/RemoteImage";
import type { RankingPeriod, Video } from "@/types";
import type { HomeUiRankingType } from "@/types/ranking";

interface VideoCardProps {
  video: Video;
  rank: number;
  period: RankingPeriod;
  ranking: HomeUiRankingType;
  homeUrlState: HomeUrlState;
  isSearchResult?: boolean;
}

export function VideoCard({
  video,
  rank,
  period,
  ranking,
  homeUrlState,
  isSearchResult = false,
}: VideoCardProps) {
  const isFirst = rank === 1;
  const heroMetric = getCardHeroMetric(video, period);
  const secondaryVelocity = getCardSecondaryVelocity(video, period);
  const scoreMetric = getCardScoreMetric(video);
  const trendInsight = getCardTrendInsight(video, ranking, period);
  const rankLabel = isSearchResult ? `検索 #${rank}` : `#${rank}`;
  const detailHref = buildVideoDetailHref(video.id, {
    ...homeUrlState,
    period,
    ranking,
  });
  const isMeasured = video.metrics.metricsSource === "measured";

  return (
    <article
      className={`glass-card group flex h-full flex-col overflow-hidden ${isFirst ? "glass-card--gold" : ""}`}
    >
      <Link
        href={detailHref}
        className="block flex-1 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508]"
      >
        <div className="relative aspect-video overflow-hidden">
          <RemoteImage
            src={video.thumbnailUrl}
            alt={`${video.title}のサムネイル`}
            width={640}
            height={360}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            fallbackClassName="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

          <div
            className={`absolute left-3 top-3 flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-sm font-bold backdrop-blur-md sm:left-4 sm:top-4 ${
              isFirst
                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/40"
                : "border border-white/10 bg-black/50 text-zinc-100"
            }`}
          >
            {rankLabel}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 sm:bottom-4 sm:left-4 sm:right-4">
            <MetricsSourceBadge source={video.metrics.metricsSource} />
            <span
              className="rounded-lg bg-black/50 px-2 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur-sm"
              title={scoreMetric.explanation ?? RADAR_SCORE_EXPLANATION}
            >
              {scoreMetric.label} {scoreMetric.value}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="space-y-1.5">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-50 transition group-hover:text-white">
              {video.title}
            </h2>
            <p className="truncate text-sm text-zinc-400">{video.channel.name}</p>
            <p className="text-xs text-zinc-500">
              {formatRelativePublishedAt(video.publishedAt)} · 総再生{" "}
              {formatCount(video.viewCount)}回
            </p>
            <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-zinc-300">
              {trendInsight}
            </p>
          </div>

          <div
            className={`rounded-xl border px-4 py-3 ${
              isMeasured
                ? "border-emerald-500/25 bg-emerald-500/10"
                : "border-violet-500/25 bg-violet-500/10"
            }`}
          >
            <p
              className={`text-[11px] font-medium uppercase tracking-wider ${
                isMeasured ? "text-emerald-300/90" : "text-violet-300/90"
              }`}
            >
              {heroMetric.label}
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                isMeasured ? "text-emerald-100" : "text-violet-100"
              }`}
            >
              {heroMetric.value}
            </p>
            {secondaryVelocity ? (
              <p className="mt-1 text-xs tabular-nums text-zinc-400">
                {secondaryVelocity.label} {secondaryVelocity.value}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
