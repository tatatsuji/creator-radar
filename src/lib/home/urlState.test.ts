import { describe, expect, it } from "vitest";

import {
  buildHomeHref,
  buildVideoDetailHref,
  parseHomeUrlState,
  parseVideoDetailHomeState,
} from "@/lib/home/urlState";

function params(input: Record<string, string>): URLSearchParams {
  return new URLSearchParams(input);
}

describe("home url state", () => {
  it("parses ranking, period, and genre from search params", () => {
    expect(
      parseHomeUrlState(
        params({ ranking: "early_rise", period: "7d", genre: "game" }),
      ),
    ).toEqual({
      ranking: "early_rise",
      period: "7d",
      genre: "game",
      format: "all",
    });
  });

  it("maps legacy rising mode to early_rise ranking", () => {
    expect(parseHomeUrlState(params({ mode: "rising", period: "3d" }))).toEqual({
      ranking: "early_rise",
      period: "3d",
      genre: "all",
      format: "all",
    });
  });

  it("falls back to defaults for missing values", () => {
    expect(parseHomeUrlState(new URLSearchParams())).toEqual({
      ranking: "buzz",
      period: "24h",
      genre: "all",
      format: "all",
    });
  });

  it("builds home href with non-default filters", () => {
    expect(
      buildHomeHref({
        ranking: "early_rise",
        period: "7d",
        genre: "game",
        format: "all",
      }),
    ).toBe("/?ranking=early_rise&period=7d&genre=game");
  });

  it("includes format in home href when not all", () => {
    expect(
      buildHomeHref({
        ranking: "buzz",
        period: "24h",
        genre: "all",
        format: "short",
      }),
    ).toBe("/?format=short");
  });

  it("builds video detail href and round-trips home state", () => {
    const state = {
      ranking: "early_rise" as const,
      period: "7d" as const,
      genre: "game" as const,
      format: "all" as const,
    };
    const href = buildVideoDetailHref("abc123", state);

    expect(href).toBe("/videos/abc123?period=7d&genre=game&ranking=early_rise");
    expect(parseVideoDetailHomeState(new URL(href, "https://example.com").searchParams)).toEqual(
      state,
    );
  });
});
