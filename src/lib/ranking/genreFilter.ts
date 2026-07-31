import {
  getYouTubeCategoryId,
  KNOWN_CATEGORY_IDS,
} from "@/lib/youtube/categories";
import type { GenreId } from "@/types";

export function matchesVideoGenre(input: {
  categoryId: string | null | undefined;
  isShort?: boolean | null;
  genre: GenreId;
}): boolean {
  const { genre } = input;
  const categoryId = input.categoryId ?? null;

  if (genre === "all") {
    return true;
  }

  if (genre === "shorts") {
    return input.isShort === true;
  }

  if (genre === "other") {
    return categoryId !== null && !KNOWN_CATEGORY_IDS.includes(categoryId);
  }

  return categoryId === getYouTubeCategoryId(genre);
}
