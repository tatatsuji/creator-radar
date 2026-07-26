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
    });
  });

  it("maps legacy rising mode to early_rise ranking", () => {
    expect(parseHomeUrlState(params({ mode: "rising", period: "3d" }))).toEqual({
      ranking: "early_rise",
      period: "3d",
      genre: "all",
    });
  });

  it("falls back to defaults for missing values", () => {
    expect(parseHomeUrlState(new URLSearchParams())).toEqual({
      ranking: "buzz",
      period: "24h",
      genre: "all",
    });
  });

  it("builds home href with non-default filters", () => {
    expect(
      buildHomeHref({
        ranking: "potential",
        period: "7d",
        genre: "game",
      }),
    ).toBe("/?ranking=potential&period=7d&genre=game");
  });

  it("builds video detail href and round-trips home state", () => {
    const state = {
      ranking: "launch_speed" as const,
      period: "7d" as const,
      genre: "game" as const,
    };
    const href = buildVideoDetailHref("abc123", state);

    expect(href).toBe("/videos/abc123?period=7d&genre=game&ranking=launch_speed");
    expect(parseVideoDetailHomeState(new URL(href, "https://example.com").searchParams)).toEqual(
      state,
    );
  });
});
