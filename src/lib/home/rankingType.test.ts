import { describe, expect, it } from "vitest";

import {
  parseHomeRankingType,
  parseRankingType,
} from "@/lib/home/rankingType";

describe("ranking type", () => {
  it("parses buzz and early_rise", () => {
    expect(parseRankingType("early_rise", null)).toBe("early_rise");
    expect(parseRankingType("buzz", null)).toBe("buzz");
  });

  it("still parses hidden rankings for API use", () => {
    expect(parseRankingType("launch_speed", null)).toBe("launch_speed");
    expect(parseRankingType("potential", null)).toBe("potential");
  });

  it("maps hidden rankings to buzz on home UI", () => {
    expect(parseHomeRankingType("launch_speed", null)).toBe("buzz");
    expect(parseHomeRankingType("potential", null)).toBe("buzz");
    expect(parseHomeRankingType("early_rise", null)).toBe("early_rise");
  });

  it("maps legacy rising mode to early_rise", () => {
    expect(parseRankingType(null, "rising")).toBe("early_rise");
  });

  it("defaults to buzz", () => {
    expect(parseRankingType(null, null)).toBe("buzz");
  });
});
