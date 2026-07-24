import type { GenreId } from "@/types";

export const genreToYouTubeCategoryId: Partial<
  Record<Exclude<GenreId, "all" | "other">, string>
> = {
  entertainment: "24",
  music: "10",
  game: "20",
  education: "27",
  news: "25",
  howto: "26",
  sports: "17",
};

export function getYouTubeCategoryId(genre: GenreId): string | undefined {
  if (genre === "all" || genre === "other") {
    return undefined;
  }

  return genreToYouTubeCategoryId[genre];
}
