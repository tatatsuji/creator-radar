import { MetricsSourceBadge } from "@/components/ui/MetricsSourceBadge";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { VideoDetailPeriodTabs } from "@/components/video/VideoDetailPeriodTabs";
import {
  formatRelativePublishedAt,
  formatSubscriberCount,
} from "@/lib/format";
import type { HomeUrlState } from "@/lib/home/urlState";
import { RANKING_TYPE_LABELS } from "@/lib/ranking/rankingMeta";
import type { RankingPeriod, Video } from "@/types";

interface VideoAnalysisHeaderProps {
  video: Video;
  period: RankingPeriod;
  homeUrlState: HomeUrlState;
}

export function VideoAnalysisHeader({
  video,
  period,
  homeUrlState,
}: VideoAnalysisHeaderProps) {
  const rankingLabel = RANKING_TYPE_LABELS[homeUrlState.ranking];
  const contentKindLabel =
    video.contentKind === "short"
      ? "Shorts"
      : video.contentKind === "live"
        ? "ライブ"
        : video.contentKind === "regular"
          ? "通常動画"
          : null;

  return (
    <section className="glass-panel overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="relative aspect-video overflow-hidden lg:aspect-auto lg:min-h-[220px]">
          <RemoteImage
            src={video.thumbnailUrl}
            alt={`${video.title}のサムネイル`}
            width={1280}
            height={720}
            className="h-full w-full object-cover"
            fallbackClassName="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/20" />
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <MetricsSourceBadge source={video.metrics.metricsSource} />
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                {rankingLabel}から
              </span>
              {contentKindLabel ? (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                  {contentKindLabel}
                </span>
              ) : null}
            </div>
            <h1 className="text-xl font-bold leading-snug tracking-tight text-zinc-50 sm:text-2xl">
              {video.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <RemoteImage
              src={video.channel.thumbnailUrl}
              alt=""
              width={48}
              height={48}
              className="h-11 w-11 rounded-full border border-white/10 object-cover sm:h-12 sm:w-12"
              fallbackClassName="h-11 w-11 rounded-full sm:h-12 sm:w-12"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200 sm:text-base">
                {video.channel.name}
              </p>
              <p className="text-xs text-zinc-500 sm:text-sm">
                登録者{" "}
                {formatSubscriberCount(
                  video.channel.subscriberCount,
                  video.channel.subscriberCountHidden,
                )}
                · 公開 {formatRelativePublishedAt(video.publishedAt)}
              </p>
            </div>
          </div>

          {video.description?.trim() ? (
            <details className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-zinc-300">
                動画の説明を表示
              </summary>
              <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                {video.description.trim()}
              </p>
            </details>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              分析期間
            </p>
            <VideoDetailPeriodTabs
              videoId={video.id}
              period={period}
              homeUrlState={homeUrlState}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
