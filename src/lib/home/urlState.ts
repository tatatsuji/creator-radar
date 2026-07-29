import { parseContentFormatFilter, type ContentFormatFilter } from "@/lib/home/contentFormat";
import { parseRankingType, type RankingType } from "@/lib/home/rankingType";
import { parseRankingPeriod } from "@/lib/ranking/periods";
import { isGenreId } from "@/types/observability";
import type { GenreId, RankingPeriod } from "@/types";

export type { ContentFormatFilter };

export interface HomeUrlState {
  ranking: RankingType;
  period: RankingPeriod;
  genre: GenreId;
  format: ContentFormatFilter;
}

export const DEFAULT_HOME_URL_STATE: HomeUrlState = {
  ranking: "buzz",
  period: "24h",
  genre: "all",
  format: "all",
};

type SearchParamsReader = {
  get: (key: string) => string | null;
};

export function parseGenreId(value?: string | null): GenreId {
  if (value && isGenreId(value)) {
    return value;
  }

  return "all";
}

export function parseHomeUrlState(searchParams: SearchParamsReader): HomeUrlState {
  return {
    ranking: parseRankingType(
      searchParams.get("ranking"),
      searchParams.get("mode"),
    ),
    period: parseRankingPeriod(searchParams.get("period")),
    genre: parseGenreId(searchParams.get("genre")),
    format: parseContentFormatFilter(searchParams.get("format")),
  };
}

export function buildHomeSearchParams(state: HomeUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.ranking !== DEFAULT_HOME_URL_STATE.ranking) {
    params.set("ranking", state.ranking);
  }

  if (state.period !== DEFAULT_HOME_URL_STATE.period) {
    params.set("period", state.period);
  }

  if (state.genre !== DEFAULT_HOME_URL_STATE.genre) {
    params.set("genre", state.genre);
  }

  if (state.format !== DEFAULT_HOME_URL_STATE.format) {
    params.set("format", state.format);
  }

  return params;
}

export function buildHomeHref(
  state: HomeUrlState,
  pathname = "/",
): string {
  const query = buildHomeSearchParams(state).toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildVideoDetailHref(
  videoId: string,
  state: HomeUrlState,
): string {
  const params = new URLSearchParams();
  params.set("period", state.period);

  if (state.genre !== DEFAULT_HOME_URL_STATE.genre) {
    params.set("genre", state.genre);
  }

  if (state.ranking !== DEFAULT_HOME_URL_STATE.ranking) {
    params.set("ranking", state.ranking);
  }

  return `/videos/${videoId}?${params.toString()}`;
}

export function parseVideoDetailHomeState(searchParams: SearchParamsReader): HomeUrlState {
  return parseHomeUrlState(searchParams);
}

/** @deprecated Use HomeUrlState.ranking */
export function getHomeModeFromState(state: HomeUrlState): "buzz" | "rising" {
  return state.ranking === "early_rise" ? "rising" : "buzz";
}
