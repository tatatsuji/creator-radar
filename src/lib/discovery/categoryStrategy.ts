import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import type { GenreId } from "@/types";

export type CategoryFetchTier = "everyRun" | "daily" | "rotation" | "searchOnly";

export interface CategoryStrategyConfig {
  /** Fetched on every discovery run (6h). High-volume JP buzz categories. */
  everyRun: readonly GenreId[];
  /** Fetched once per day (first run of the day). */
  daily: readonly GenreId[];
  /** One genre per run, rotated. */
  rotation: readonly GenreId[];
  /** Covered by general search only; no dedicated category/mostPopular fetch. */
  searchOnly: readonly GenreId[];
  /** Discovery runs per UTC day (Vercel cron every 6h). */
  runsPerDay: number;
}

export const DEFAULT_CATEGORY_STRATEGY: CategoryStrategyConfig = {
  everyRun: ["entertainment", "music", "game"],
  daily: ["news"],
  rotation: ["howto", "sports"],
  searchOnly: ["education"],
  runsPerDay: 4,
};

export function getCategoryStrategy(): CategoryStrategyConfig {
  return OBSERVABILITY_CONFIG.phase1Discovery.categoryStrategy;
}

/** Genres for category_search this run (deduped, stable order). */
export function pickGenresForCategoryFetch(
  runIndex: number,
  strategy: CategoryStrategyConfig = getCategoryStrategy(),
): GenreId[] {
  const selected: GenreId[] = [];

  for (const genre of strategy.everyRun) {
    if (!selected.includes(genre)) {
      selected.push(genre);
    }
  }

  if (runIndex % strategy.runsPerDay === 0) {
    for (const genre of strategy.daily) {
      if (!selected.includes(genre)) {
        selected.push(genre);
      }
    }
  }

  if (strategy.rotation.length > 0) {
    const rotationGenre =
      strategy.rotation[runIndex % strategy.rotation.length]!;
    if (!selected.includes(rotationGenre)) {
      selected.push(rotationGenre);
    }
  }

  return selected;
}

export interface MostPopularFetchPlan {
  genre: GenreId;
  maxResults: number;
}

/** mostPopular fetch plan for this run. Always includes JP overall chart. */
export function pickMostPopularFetches(
  runIndex: number,
  strategy: CategoryStrategyConfig = getCategoryStrategy(),
): MostPopularFetchPlan[] {
  const plans: MostPopularFetchPlan[] = [
    { genre: "all", maxResults: OBSERVABILITY_CONFIG.phase1Discovery.mostPopularAllMaxResults },
  ];

  for (const genre of strategy.everyRun) {
    plans.push({
      genre,
      maxResults: OBSERVABILITY_CONFIG.phase1Discovery.mostPopularCategoryMaxResults,
    });
  }

  if (runIndex % strategy.runsPerDay === 0) {
    for (const genre of strategy.daily) {
      plans.push({
        genre,
        maxResults: OBSERVABILITY_CONFIG.phase1Discovery.mostPopularCategoryMaxResults,
      });
    }
  }

  if (strategy.rotation.length > 0) {
    const rotationGenre =
      strategy.rotation[runIndex % strategy.rotation.length]!;
    plans.push({
      genre: rotationGenre,
      maxResults: OBSERVABILITY_CONFIG.phase1Discovery.mostPopularCategoryMaxResults,
    });
  }

  return plans;
}

/** 6-hour discovery run index (shared by cron and category rotation). */
export function discoveryRunIndex(nowMs = Date.now()): number {
  const intervalMs =
    OBSERVABILITY_CONFIG.phase1Discovery.discoveryRunIntervalMs;
  return Math.floor(nowMs / intervalMs);
}
