import { describe, expect, it } from "vitest";

import { matchesVideoGenre } from "@/lib/ranking/genreFilter";

describe("matchesVideoGenre", () => {
  it("matches all genres without filtering", () => {
    expect(
      matchesVideoGenre({ genre: "all", categoryId: "24", isShort: false }),
    ).toBe(true);
  });

  it("matches shorts by is_short flag only", () => {
    expect(
      matchesVideoGenre({ genre: "shorts", categoryId: "24", isShort: true }),
    ).toBe(true);
    expect(
      matchesVideoGenre({ genre: "shorts", categoryId: "24", isShort: false }),
    ).toBe(false);
    expect(
      matchesVideoGenre({ genre: "shorts", categoryId: "24", isShort: null }),
    ).toBe(false);
  });

  it("matches youtube categories for standard genres", () => {
    expect(
      matchesVideoGenre({ genre: "game", categoryId: "20", isShort: false }),
    ).toBe(true);
    expect(
      matchesVideoGenre({ genre: "game", categoryId: "24", isShort: false }),
    ).toBe(false);
  });
});
