import Link from "next/link";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { VideoAnalysisHeader } from "@/components/video/VideoAnalysisHeader";
import { VideoCollapsibleSection } from "@/components/video/VideoCollapsibleSection";
import { VideoDetailAnalysis } from "@/components/video/VideoDetailAnalysis";
import { VideoGrowthMetrics } from "@/components/video/VideoGrowthMetrics";
import { VideoMeasuredPanel } from "@/components/video/VideoMeasuredPanel";
import { buildHomeHref, type HomeUrlState } from "@/lib/home/urlState";
import { HOME_UI_RANKING_LABELS } from "@/lib/ranking/rankingMeta";
import type { RankingOptimizedAnalysis } from "@/lib/video/rankingAnalysis/types";
import type { RankingPeriod, Video } from "@/types";

interface VideoDetailViewProps {
  video: Video;
  period: RankingPeriod;
  homeUrlState: HomeUrlState;
  analysis: RankingOptimizedAnalysis;
}

export function VideoDetailView({
  video,
  period,
  homeUrlState,
  analysis,
}: VideoDetailViewProps) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
  const rankingHref = buildHomeHref(homeUrlState);
  const rankingLabel = HOME_UI_RANKING_LABELS[homeUrlState.ranking];

  return (
    <div className="app-background flex min-h-screen flex-col pb-24 sm:pb-0">
      <SiteHeader
        variant="default"
        period={period}
        backHref={rankingHref}
        backLabel={`${rankingLabel}に戻る`}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="space-y-5 sm:space-y-6">
          <VideoAnalysisHeader
            video={video}
            period={period}
            homeUrlState={homeUrlState}
          />
          <VideoDetailAnalysis analysis={analysis} video={video} />

          <VideoCollapsibleSection
            title="詳しい数値"
            description="ランキングと同じ指標の内訳"
          >
            <VideoGrowthMetrics video={video} period={period} compact />
          </VideoCollapsibleSection>

          <VideoCollapsibleSection
            title="再生の推移グラフ"
            description="実測データがある場合に表示されます"
          >
            <VideoMeasuredPanel videoId={video.id} embedded />
          </VideoCollapsibleSection>

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
              {rankingLabel}に戻る
            </Link>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.08] bg-[#050508]/95 p-3 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Link
            href={rankingHref}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-200"
          >
            一覧へ
          </Link>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-semibold text-white"
          >
            YouTube
          </a>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
