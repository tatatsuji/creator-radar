import { describe, expect, it } from "vitest";

import {
  buildDiscoveryMetadata,
  hashDiscoverySearchQuery,
  inferFormatHintFromVideo,
} from "@/lib/discovery/discoveryMetadata";

describe("discoveryMetadata", () => {
  it("builds metadata with genre and format hints", () => {
    expect(
      buildDiscoveryMetadata({
        period: "24h",
        genre: "game",
        genreHint: "game",
        formatHint: "short",
        registrationPath: "candidate_discovery",
        searchQuery: "minecraft 実況",
      }),
    ).toEqual({
      period: "24h",
      genre: "game",
      genreHint: "game",
      formatHint: "short",
      registrationPath: "candidate_discovery",
      searchQueryHash: hashDiscoverySearchQuery("minecraft 実況"),
    });
  });

  it("infers format hints from classification flags", () => {
    expect(inferFormatHintFromVideo({ isShort: true, isLive: false })).toBe(
      "short",
    );
    expect(inferFormatHintFromVideo({ isShort: false, isLive: true })).toBe(
      "live",
    );
    expect(inferFormatHintFromVideo({ isShort: false, isLive: false })).toBe(
      "regular",
    );
  });
});
