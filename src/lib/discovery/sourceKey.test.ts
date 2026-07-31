import { describe, expect, it } from "vitest";

import {
  SourceKeyValidationError,
  buildCategorySearchSourceKey,
  buildManualSourceKey,
  buildMostPopularSourceKey,
  buildRelatedSourceKey,
  buildSearchSourceKey,
  buildSeedSourceKey,
  buildWatchlistUploadSourceKey,
  buildWebsubSourceKey,
  hashSearchQuery,
  normalizeSearchQuery,
} from "@/lib/discovery/sourceKey";

const SAMPLE_CHANNEL_ID = "UC1234567890abcdefghij";

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  hello   world  ")).toBe("hello world");
  });

  it("lowercases queries", () => {
    expect(normalizeSearchQuery("Hello WORLD")).toBe("hello world");
  });

  it("rejects empty strings", () => {
    expect(() => normalizeSearchQuery("   ")).toThrow(SourceKeyValidationError);
  });
});

describe("hashSearchQuery", () => {
  it("returns the same hash for the same normalized input", () => {
    const first = hashSearchQuery("  Test Query ");
    const second = hashSearchQuery("test   query");
    expect(first).toBe(second);
  });

  it("does not include raw query text", () => {
    const query = "unique secret search phrase";
    const hash = hashSearchQuery(query);
    expect(hash.startsWith("q:")).toBe(true);
    expect(hash).not.toContain(query);
    expect(hash.toLowerCase()).not.toContain("secret");
  });
});

describe("source key builders", () => {
  it("builds stable channel-based keys", () => {
    expect(buildSeedSourceKey(SAMPLE_CHANNEL_ID)).toBe(SAMPLE_CHANNEL_ID);
    expect(buildWatchlistUploadSourceKey(SAMPLE_CHANNEL_ID)).toBe(
      SAMPLE_CHANNEL_ID,
    );
    expect(
      buildWebsubSourceKey(SAMPLE_CHANNEL_ID, "dQw4w9WgXcQ"),
    ).toBe(`websub:${SAMPLE_CHANNEL_ID}:dQw4w9WgXcQ`);
  });

  it("builds distinct keys per source type", () => {
    const searchKey = buildSearchSourceKey("test query");
    const categoryKey = buildCategorySearchSourceKey("20", "test query");
    const popularKey = buildMostPopularSourceKey("jp", "all");
    const manualKey = buildManualSourceKey("operator-001");
    const relatedKey = buildRelatedSourceKey({
      originVideoId: "dQw4w9WgXcQ",
    });

    const keys = [
      searchKey,
      categoryKey,
      popularKey,
      manualKey,
      relatedKey,
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("builds category search keys without raw query text", () => {
    const key = buildCategorySearchSourceKey("20", "secret query text");
    expect(key.startsWith("20:q:")).toBe(true);
    expect(key).not.toContain("secret query text");
  });

  it("builds most popular keys with normalized region code", () => {
    expect(buildMostPopularSourceKey("jp", "all")).toBe("JP:all");
    expect(buildMostPopularSourceKey("JP", "20")).toBe("JP:20");
  });

  it("builds manual and related keys in documented formats", () => {
    expect(buildManualSourceKey("operator-001")).toBe("manual:operator-001");
    expect(buildRelatedSourceKey({ originVideoId: "dQw4w9WgXcQ" })).toBe(
      "origin:dQw4w9WgXcQ",
    );
    expect(buildRelatedSourceKey({ themeKey: "gaming highlights" })).toMatch(
      /^theme:q:[a-f0-9]{16}$/,
    );
  });

  it("rejects invalid channel and video ids", () => {
    expect(() => buildSeedSourceKey("")).toThrow(SourceKeyValidationError);
    expect(() => buildSeedSourceKey("invalid")).toThrow(
      SourceKeyValidationError,
    );
    expect(() =>
      buildRelatedSourceKey({ originVideoId: "too-short" }),
    ).toThrow(SourceKeyValidationError);
  });
});
