import Link from "next/link";

import {
  formatCount,
  formatSubscriberCount,
  formatViewsPerSubscriber,
} from "@/lib/format";
import { getVelocityDisplay } from "@/lib/ranking/metrics";
import { MetricsSourceBadge } from "@/components/ui/MetricsSourceBadge";
import type { RankingPeriod, Video } from "@/types";

interface VideoCardProps {
  video: Video;
  rank: number;
  period: RankingPeriod;
}

export function VideoCard({ video, rank, period }: VideoCardProps) {
  const isFirst = rank === 1;
  const velocity = getVelocityDisplay(video, period);

  return (
    <Link
      href={`/videos/${video.id}?period=${period}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508] rounded-2xl"
    >
      <article
        className={`glass-card group overflow-hidden ${isFirst ? "glass-card--gold" : ""}`}
      >
        <div className="relative aspect-video overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnailUrl}
            alt={`${video.title}のサムネイル`}
            width={320}
            height={180}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          <div
            className={`absolute left-4 top-4 flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-sm font-bold backdrop-blur-md ${
              isFirst
                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/40"
                : "border border-white/10 bg-black/50 text-zinc-100"
            }`}
          >
            #{rank}
          </div>

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <MetricsSourceBadge source={video.metrics.metricsSource} />
            <div className="rounded-xl border border-white/10 bg-black/50 px-2.5 py-1 text-xs font-medium text-violet-200 backdrop-blur-md">
              急上昇 {Math.round(video.metrics.rankingScore)}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <h2 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-zinc-50 transition group-hover:text-white">
              {video.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{video.channel.name}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <Metric label="再生数" value={`${formatCount(video.viewCount)}回`} />
            <Metric
              label="登録者数"
              value={formatSubscriberCount(
                video.channel.subscriberCount,
                video.channel.subscriberCountHidden,
              )}
            />
            <Metric
              label="再生/登録者"
              value={formatViewsPerSubscriber(
                video.metrics.viewsPerSubscriber,
                video.channel.subscriberCountHidden,
              )}
              accent
            />
            <Metric
              label="再生速度"
              value={`${velocity.value}${velocity.unit}`}
              accent
            />
          </dl>
        </div>
      </article>
    </Link>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-semibold tabular-nums ${
          accent ? "text-violet-300" : "text-zinc-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
