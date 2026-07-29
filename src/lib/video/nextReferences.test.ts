import { describe, expect, it } from "vitest";

import { DEFAULT_HOME_URL_STATE } from "@/lib/home/urlState";
import { getVideoNextReferences } from "@/lib/video/nextReferences";

describe("getVideoNextReferences", () => {
  it("suggests cross-ranking and format exploration links", () => {
    const links = getVideoNextReferences({
      ...DEFAULT_HOME_URL_STATE,
      ranking: "buzz",
    });

    expect(links.some((link) => link.label.includes("伸び始め"))).toBe(true);
    expect(links.some((link) => link.label.includes("Shorts"))).toBe(true);
    expect(links.some((link) => link.label.includes("今日の発見"))).toBe(true);
  });

  it("avoids duplicate shorts link when already in shorts context", () => {
    const links = getVideoNextReferences({
      ...DEFAULT_HOME_URL_STATE,
      format: "short",
    });

    expect(links.filter((link) => link.id === "format-short")).toHaveLength(0);
  });
});
