import type { GenreId } from "@/types";

export const genreToYouTubeCategoryId: Partial<
  Record<Exclude<GenreId, "all" | "other" | "shorts">, string>
> = {
  entertainment: "24",
  music: "10",
  game: "20",
  education: "27",
  news: "25",
  howto: "26",
  sports: "17",
};

export const KNOWN_CATEGORY_IDS = Object.values(genreToYouTubeCategoryId);

/** Genres whose category has no mostPopular chart in JP region. */
export const GENRES_WITHOUT_POPULAR_CHART = new Set<GenreId>(["education"]);

export function genreSupportsPopularChart(genre: GenreId): boolean {
  if (genre === "shorts") {
    return false;
  }

  if (genre === "all" || genre === "other") {
    return true;
  }

  return !GENRES_WITHOUT_POPULAR_CHART.has(genre);
}

export function getYouTubeCategoryId(genre: GenreId): string | undefined {
  if (genre === "all" || genre === "other" || genre === "shorts") {
    return undefined;
  }

  return genreToYouTubeCategoryId[genre];
}
