import Link from "next/link";

import {
  formatCount,
  formatSubscriberCount,
  formatViewsPerSubscriber,
} from "@/lib/format";
import { getVelocityDisplay } from "@/lib/ranking/metrics";
import { MetricsSourceBadge } from "@/components/ui/MetricsSourceBadge";
import type { RankingPeriod, Video } from "@/types";

interface VideoDetailViewProps {
  video: Video;
  period: RankingPeriod;
}

export function VideoDetailView({ video, period }: VideoDetailViewProps) {
  const velocity = getVelocityDisplay(video, period);
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <div className="app-background min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 lg:px-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            ランキングに戻る
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
            Video Detail
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="glass-panel overflow-hidden">
          <div className="relative aspect-video w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt={`${video.title}のサムネイル`}
              width={1280}
              height={720}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 backdrop-blur-md">
                急上昇スコア {Math.round(video.metrics.rankingScore)}
              </div>
              <MetricsSourceBadge
                source={video.metrics.metricsSource}
                className="px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="space-y-8 p-6 lg:p-8">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-zinc-50 lg:text-3xl">
                {video.title}
              </h1>
              <p className="text-base text-zinc-400">{video.channel.name}</p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailMetric
                label="再生数"
                value={`${formatCount(video.viewCount)}回`}
              />
              <DetailMetric
                label="登録者数"
                value={formatSubscriberCount(
                  video.channel.subscriberCount,
                  video.channel.subscriberCountHidden,
                )}
              />
              <DetailMetric
                label="再生速度"
                value={`${velocity.value}${velocity.unit}`}
                accent
              />
              <DetailMetric
                label="再生/登録者比"
                value={formatViewsPerSubscriber(
                  video.metrics.viewsPerSubscriber,
                  video.channel.subscriberCountHidden,
                )}
                accent
              />
              <DetailMetric
                label="集計期間"
                value={
                  period === "24h"
                    ? "24時間"
                    : period === "3d"
                      ? "3日間"
                      : "7日間"
                }
              />
              <DetailMetric
                label="公開日"
                value={new Date(video.publishedAt).toLocaleDateString("ja-JP")}
              />
            </dl>

            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-500 sm:w-auto"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
              </svg>
              YouTubeで開く
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd
        className={`mt-2 text-lg font-semibold tabular-nums ${
          accent ? "text-violet-300" : "text-zinc-100"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
