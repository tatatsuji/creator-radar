import { genres } from "@/data/genres";
import { CONTENT_FORMAT_FILTERS } from "@/lib/home/contentFormat";
import type { HomeUrlState } from "@/lib/home/urlState";
import { RANKING_TYPE_TITLES } from "@/lib/ranking/rankingMeta";
import {
  getRankingViewDefinition,
  resolveActiveViewFromState,
} from "@/lib/ranking/rankingViewContext";
import type { RankingType } from "@/types/ranking";

interface RankingViewContextBannerProps {
  homeUrlState: HomeUrlState;
  ranking: RankingType;
}

export function RankingViewContextBanner({
  homeUrlState,
  ranking,
}: RankingViewContextBannerProps) {
  const activeView = resolveActiveViewFromState(homeUrlState);
  const view = getRankingViewDefinition(activeView);

  const genreLabel =
    homeUrlState.genre !== "all"
      ? genres.find((genre) => genre.id === homeUrlState.genre)?.label
      : null;

  const formatLabel =
    homeUrlState.format !== "all"
      ? CONTENT_FORMAT_FILTERS.find((item) => item.id === homeUrlState.format)
          ?.label
      : null;

  const title =
    activeView === "genre" && genreLabel
      ? `${genreLabel}ジャンルの${RANKING_TYPE_TITLES[ranking]}`
      : activeView === "shorts"
        ? `Shorts × ${RANKING_TYPE_TITLES[ranking]}`
        : activeView === "live"
          ? `ライブ × ${RANKING_TYPE_TITLES[ranking]}`
          : RANKING_TYPE_TITLES[ranking];

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
        {view.label}の見方
      </p>
      <p className="mt-1 text-base font-semibold text-zinc-100 sm:text-lg">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {view.description}
      </p>
      {genreLabel || formatLabel ? (
        <p className="mt-2 text-xs text-zinc-500">
          フィルター:
          {[genreLabel, formatLabel].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
