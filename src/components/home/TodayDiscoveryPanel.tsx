import Link from "next/link";

import { RemoteImage } from "@/components/ui/RemoteImage";
import { formatRankingUpdatedAt } from "@/lib/format";
import {
  buildHomeHref,
  buildVideoDetailHref,
  DEFAULT_HOME_URL_STATE,
  type HomeUrlState,
} from "@/lib/home/urlState";
import type { TodayDiscoveryPayload } from "@/lib/home/todayDiscovery";
import type { HomeUiRankingType } from "@/types/ranking";

interface TodayDiscoveryPanelProps {
  discovery: TodayDiscoveryPayload;
  homeUrlState: HomeUrlState;
}

function buildDiscoveryDetailHref(
  videoId: string,
  ranking: TodayDiscoveryPayload["items"][number]["ranking"],
  homeUrlState: HomeUrlState,
): string {
  const rankingType: HomeUiRankingType =
    ranking === "shorts" || ranking === "live" ? "buzz" : ranking;

  return buildVideoDetailHref(videoId, {
    ...homeUrlState,
    ranking: rankingType,
    period: "24h",
    format:
      ranking === "shorts"
        ? "short"
        : ranking === "live"
          ? "live"
          : homeUrlState.format,
  });
}

function buildDiscoveryListHref(
  ranking: TodayDiscoveryPayload["items"][number]["ranking"],
  homeUrlState: HomeUrlState,
): string {
  if (ranking === "shorts") {
    return buildHomeHref({
      ...homeUrlState,
      ranking: "buzz",
      period: "24h",
      format: "short",
    });
  }

  if (ranking === "live") {
    return buildHomeHref({
      ...homeUrlState,
      ranking: "buzz",
      period: "24h",
      format: "live",
    });
  }

  return buildHomeHref({
    ...homeUrlState,
    ranking,
    period: "24h",
  });
}

export function TodayDiscoveryPanel({
  discovery,
  homeUrlState,
}: TodayDiscoveryPanelProps) {
  if (discovery.items.length === 0) {
    return null;
  }

  return (
    <section
      className="glass-panel overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-violet-500/[0.06]"
      aria-labelledby="today-discovery-heading"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              今日の発見
            </p>
            <h2
              id="today-discovery-heading"
              className="text-lg font-bold text-zinc-50 sm:text-xl"
            >
              {discovery.dateLabel} — いま注目の動画
            </h2>
            <p className="text-sm leading-relaxed text-zinc-300">
              {discovery.summary}
            </p>
          </div>
          {discovery.dataFreshnessAt ? (
            <p className="text-xs text-zinc-500">
              {formatRankingUpdatedAt(discovery.dataFreshnessAt)}
            </p>
          ) : null}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {discovery.items.map((item) => {
            const detailHref = buildDiscoveryDetailHref(
              item.video.id,
              item.ranking,
              homeUrlState,
            );
            const listHref = buildDiscoveryListHref(item.ranking, homeUrlState);

            return (
              <li
                key={item.id}
                className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 sm:p-4"
              >
                <div className="flex gap-3">
                  <Link
                    href={detailHref}
                    className="relative block h-20 w-32 shrink-0 overflow-hidden rounded-xl"
                  >
                    <RemoteImage
                      src={item.video.thumbnailUrl}
                      alt=""
                      width={320}
                      height={180}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full"
                    />
                    <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      {item.rankingLabel}
                    </span>
                  </Link>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[11px] font-medium text-violet-200/90">
                      {item.roleLabel}
                    </p>
                    <Link
                      href={detailHref}
                      className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-50 hover:text-white"
                    >
                      {item.video.title}
                    </Link>
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                      {item.insight}
                    </p>
                    <Link
                      href={listHref}
                      className="inline-flex text-xs font-medium text-violet-300 hover:text-violet-200"
                    >
                      {item.rankingLabel}一覧へ →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-zinc-500">
          毎日更新。バズ・伸び始めと、Shorts / ライブの候補をピックアップしています。
        </p>
      </div>
    </section>
  );
}
