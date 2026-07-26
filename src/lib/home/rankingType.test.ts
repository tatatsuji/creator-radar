import { describe, expect, it } from "vitest";

import { parseRankingType } from "@/lib/home/rankingType";

describe("ranking type", () => {
  it("parses explicit ranking values", () => {
    expect(parseRankingType("potential", null)).toBe("potential");
  });

  it("maps legacy rising mode to early_rise", () => {
    expect(parseRankingType(null, "rising")).toBe("early_rise");
  });

  it("defaults to buzz", () => {
    expect(parseRankingType(null, null)).toBe("buzz");
  });
});
