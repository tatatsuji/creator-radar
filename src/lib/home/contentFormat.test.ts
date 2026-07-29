import { describe, expect, it } from "vitest";

import {
  matchesContentFormatFilter,
  parseContentFormatFilter,
} from "@/lib/home/contentFormat";

describe("contentFormat", () => {
  it("parses format filter from query param", () => {
    expect(parseContentFormatFilter("short")).toBe("short");
    expect(parseContentFormatFilter("live")).toBe("live");
    expect(parseContentFormatFilter("invalid")).toBe("all");
  });

  it("matches video content kinds", () => {
    expect(matchesContentFormatFilter("short", "short")).toBe(true);
    expect(matchesContentFormatFilter("short", "live")).toBe(false);
    expect(matchesContentFormatFilter("unknown", "regular")).toBe(true);
    expect(matchesContentFormatFilter(undefined, "all")).toBe(true);
  });
});
