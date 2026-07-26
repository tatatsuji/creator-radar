import { describe, expect, it } from "vitest";

import { isHomeMode, parseHomeMode } from "@/lib/home/mode";

describe("home mode", () => {
  it("defaults to buzz when mode is missing or unknown", () => {
    expect(parseHomeMode()).toBe("buzz");
    expect(parseHomeMode(null)).toBe("buzz");
    expect(parseHomeMode("")).toBe("buzz");
    expect(parseHomeMode("buzz")).toBe("buzz");
    expect(parseHomeMode("invalid")).toBe("buzz");
  });

  it("parses rising mode", () => {
    expect(parseHomeMode("rising")).toBe("rising");
  });

  it("validates home mode strings", () => {
    expect(isHomeMode("buzz")).toBe(true);
    expect(isHomeMode("rising")).toBe(true);
    expect(isHomeMode("other")).toBe(false);
  });
});
