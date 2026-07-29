import { describe, expect, it } from "vitest";

import { parseRankingType } from "@/lib/home/rankingType";

describe("ranking type", () => {
  it("parses buzz and early_rise", () => {
    expect(parseRankingType("early_rise", null)).toBe("early_rise");
    expect(parseRankingType("buzz", null)).toBe("buzz");
  });

  it("maps retired ranking URLs to buzz", () => {
    expect(parseRankingType("potential", null)).toBe("buzz");
    expect(parseRankingType("launch_speed", null)).toBe("buzz");
    expect(parseRankingType("subscriber_ratio", null)).toBe("buzz");
  });

  it("maps legacy rising mode to early_rise", () => {
    expect(parseRankingType(null, "rising")).toBe("early_rise");
  });

  it("defaults to buzz", () => {
    expect(parseRankingType(null, null)).toBe("buzz");
  });
});
