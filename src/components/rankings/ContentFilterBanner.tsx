import { genres } from "@/data/genres";
import { CONTENT_FORMAT_FILTERS } from "@/lib/home/contentFormat";
import type { HomeUrlState } from "@/lib/home/urlState";
import { HOME_UI_RANKING_TITLES } from "@/lib/ranking/rankingMeta";
import { getActiveContentFilter } from "@/lib/ranking/rankingViewContext";
import type { HomeUiRankingType } from "@/types/ranking";

interface ContentFilterBannerProps {
  homeUrlState: HomeUrlState;
  ranking: HomeUiRankingType;
}

export function ContentFilterBanner({
  homeUrlState,
  ranking,
}: ContentFilterBannerProps) {
  const filter = getActiveContentFilter(homeUrlState);
  if (!filter) {
    return null;
  }

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
    filter.id === "genre" && genreLabel
      ? `${genreLabel} · ${HOME_UI_RANKING_TITLES[ranking]}`
      : filter.id === "shorts"
        ? `Shorts · ${HOME_UI_RANKING_TITLES[ranking]}`
        : filter.id === "live"
          ? `ライブ · ${HOME_UI_RANKING_TITLES[ranking]}`
          : HOME_UI_RANKING_TITLES[ranking];

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
        フィルター適用中
      </p>
      <p className="mt-1 text-base font-semibold text-zinc-100 sm:text-lg">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {filter.description}
      </p>
      {genreLabel || formatLabel ? (
        <p className="mt-2 text-xs text-zinc-500">
          {[genreLabel, formatLabel].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
