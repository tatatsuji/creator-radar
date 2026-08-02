import { resolveContentKindFromClassification } from "@/lib/discovery/videoFormatClassification";
import { matchesRankingContentFormat } from "@/lib/ranking/rankingContentFormat";
import type { VideoFormat, LiveState } from "@/lib/discovery/videoFormatClassification";
import {
  getYouTubeCategoryId,
  KNOWN_CATEGORY_IDS,
} from "@/lib/youtube/categories";
import type { GenreId } from "@/types";

export function matchesVideoGenre(input: {
  categoryId: string | null | undefined;
  videoFormat?: VideoFormat | null;
  genre: GenreId;
}): boolean {
  const { genre } = input;
  const categoryId = input.categoryId ?? null;

  if (genre === "all") {
    return true;
  }

  if (genre === "shorts") {
    return input.videoFormat === "short";
  }

  if (genre === "other") {
    return categoryId !== null && !KNOWN_CATEGORY_IDS.includes(categoryId);
  }

  return categoryId === getYouTubeCategoryId(genre);
}

export function resolveRowContentKind(input: {
  videoFormat?: VideoFormat | null;
  liveState?: LiveState | null;
}): "regular" | "short" | "live" | "unknown" {
  return resolveContentKindFromClassification(input);
}
