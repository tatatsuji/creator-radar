import { describe, expect, it } from "vitest";

import {
  DEFAULT_CATEGORY_STRATEGY,
  pickGenresForCategoryFetch,
  pickMostPopularFetches,
} from "@/lib/discovery/categoryStrategy";

describe("categoryStrategy", () => {
  it("includes everyRun genres on all runs", () => {
    for (const runIndex of [0, 1, 2, 3, 4]) {
      const genres = pickGenresForCategoryFetch(runIndex, DEFAULT_CATEGORY_STRATEGY);
      expect(genres).toContain("entertainment");
      expect(genres).toContain("music");
      expect(genres).toContain("game");
    }
  });

  it("includes daily genre only on first run of the day", () => {
    expect(pickGenresForCategoryFetch(0, DEFAULT_CATEGORY_STRATEGY)).toContain("news");
    expect(pickGenresForCategoryFetch(1, DEFAULT_CATEGORY_STRATEGY)).not.toContain("news");
  });

  it("rotates howto and sports across runs", () => {
    const run0 = pickGenresForCategoryFetch(0, DEFAULT_CATEGORY_STRATEGY);
    const run1 = pickGenresForCategoryFetch(1, DEFAULT_CATEGORY_STRATEGY);
    expect(run0.includes("howto") || run0.includes("sports")).toBe(true);
    expect(run1.includes("howto") || run1.includes("sports")).toBe(true);
  });

  it("always fetches JP overall mostPopular", () => {
    const plans = pickMostPopularFetches(0, DEFAULT_CATEGORY_STRATEGY);
    expect(plans.some((plan) => plan.genre === "all")).toBe(true);
  });
});
