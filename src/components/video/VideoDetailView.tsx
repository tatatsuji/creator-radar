import Link from "next/link";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { VideoAnalysisHeader } from "@/components/video/VideoAnalysisHeader";
import { VideoAnalysisInsight } from "@/components/video/VideoAnalysisInsight";
import { VideoGrowthMetrics } from "@/components/video/VideoGrowthMetrics";
import { VideoMeasuredPanel } from "@/components/video/VideoMeasuredPanel";
import { BUZZ_VIDEOS_LABEL } from "@/lib/home/copy";
import { buildHomeHref, type HomeUrlState } from "@/lib/home/urlState";
import type { RankingPeriod, Video } from "@/types";

interface VideoDetailViewProps {
  video: Video;
  period: RankingPeriod;
  homeUrlState: HomeUrlState;
}

export function VideoDetailView({
  video,
  period,
  homeUrlState,
}: VideoDetailViewProps) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
  const rankingHref = buildHomeHref(homeUrlState);

  return (
    <div className="app-background flex min-h-screen flex-col">
      <SiteHeader
        variant="default"
        period={period}
        backHref={rankingHref}
        backLabel={BUZZ_VIDEOS_LABEL}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="space-y-6 sm:space-y-8">
          <VideoAnalysisHeader
            video={video}
            period={period}
            homeUrlState={homeUrlState}
          />
          <VideoAnalysisInsight video={video} period={period} />
          <VideoGrowthMetrics video={video} period={period} />
          <VideoMeasuredPanel videoId={video.id} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              YouTubeで視聴する
            </a>
            <Link
              href={rankingHref}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
            >
              {BUZZ_VIDEOS_LABEL}に戻る
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
