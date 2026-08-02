import { describe, expect, it } from "vitest";

import { matchesVideoGenre } from "@/lib/ranking/genreFilter";

describe("matchesVideoGenre", () => {
  it("matches all genres without filtering", () => {
    expect(
      matchesVideoGenre({ genre: "all", categoryId: "24", videoFormat: "regular" }),
    ).toBe(true);
  });

  it("matches shorts by video_format only", () => {
    expect(
      matchesVideoGenre({ genre: "shorts", categoryId: "24", videoFormat: "short" }),
    ).toBe(true);
    expect(
      matchesVideoGenre({ genre: "shorts", categoryId: "24", videoFormat: "regular" }),
    ).toBe(false);
    expect(
      matchesVideoGenre({ genre: "shorts", categoryId: "24", videoFormat: "unknown" }),
    ).toBe(false);
  });

  it("matches youtube categories for standard genres", () => {
    expect(
      matchesVideoGenre({ genre: "game", categoryId: "20", videoFormat: "regular" }),
    ).toBe(true);
    expect(
      matchesVideoGenre({ genre: "game", categoryId: "24", videoFormat: "regular" }),
    ).toBe(false);
  });
});
