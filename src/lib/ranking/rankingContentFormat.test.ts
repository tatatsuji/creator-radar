import { describe, expect, it } from "vitest";

import {
  countRankingLive,
  countRankingShorts,
  filterVideosByRankingContentFormat,
  isRankingShortVideo,
  matchesRankingContentFormat,
  matchesVideoRankingContentFormat,
  resolveRankingContentFormat,
} from "@/lib/ranking/rankingContentFormat";
import type { Video } from "@/types";

function makeVideo(
  overrides: Partial<Video> & Pick<Video, "contentKind">,
): Video {
  return {
    id: overrides.id ?? "video",
    title: overrides.title ?? "Test",
    thumbnailUrl: "",
    publishedAt: new Date().toISOString(),
    contentKind: overrides.contentKind,
    durationSeconds: overrides.durationSeconds,
    channel: {
      id: "channel",
      name: "Channel",
      subscriberCount: 1000,
      subscriberCountHidden: false,
    },
    viewCount: 1000,
    metrics: {
      period: "24h",
      viewDelta: 0,
      viewVelocity: 0,
      viewsPerSubscriber: 0,
      rankingScore: 0,
      metricsSource: "estimated",
    },
    ...overrides,
  };
}

describe("resolveRankingContentFormat", () => {
  it("uses regular videos for default and genre-specific rankings", () => {
    expect(resolveRankingContentFormat({ genre: "all", format: "all" })).toBe(
      "regular",
    );
    expect(resolveRankingContentFormat({ genre: "game", format: "all" })).toBe(
      "regular",
    );
    expect(resolveRankingContentFormat({ genre: "music", format: "regular" })).toBe(
      "regular",
    );
  });

  it("uses shorts-only for shorts genre and short format", () => {
    expect(resolveRankingContentFormat({ genre: "shorts", format: "all" })).toBe(
      "short",
    );
    expect(resolveRankingContentFormat({ genre: "all", format: "short" })).toBe(
      "short",
    );
  });

  it("uses live-only for live format", () => {
    expect(resolveRankingContentFormat({ genre: "all", format: "live" })).toBe(
      "live",
    );
  });
});

describe("isRankingShortVideo", () => {
  it("detects shorts from is_short flag", () => {
    expect(isRankingShortVideo({ isShort: true, isLive: false })).toBe(true);
  });

  it("detects shorts from duration when is_short is null", () => {
    expect(
      isRankingShortVideo({ isShort: null, isLive: false, durationSeconds: 45 }),
    ).toBe(true);
  });

  it("does not treat live streams as shorts", () => {
    expect(
      isRankingShortVideo({ isShort: null, isLive: true, durationSeconds: 0 }),
    ).toBe(false);
  });

  it("respects explicit is_short=false even for short duration", () => {
    expect(
      isRankingShortVideo({ isShort: false, isLive: false, durationSeconds: 30 }),
    ).toBe(false);
  });
});

describe("matchesRankingContentFormat", () => {
  it("excludes shorts and live from regular rankings", () => {
    expect(
      matchesRankingContentFormat({
        isShort: true,
        isLive: false,
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        isShort: false,
        isLive: true,
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        isShort: null,
        isLive: false,
        durationSeconds: 30,
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        isShort: false,
        isLive: false,
        durationSeconds: 120,
        contentFormat: "regular",
      }),
    ).toBe(true);
  });
});

describe("filterVideosByRankingContentFormat", () => {
  const mixed = [
    makeVideo({ id: "regular", contentKind: "regular", durationSeconds: 600 }),
    makeVideo({ id: "short-flag", contentKind: "short", durationSeconds: 30 }),
    makeVideo({ id: "live", contentKind: "live", durationSeconds: 0 }),
    makeVideo({
      id: "misclassified-short",
      contentKind: "unknown",
      durationSeconds: 42,
    }),
  ];

  it("shows no shorts or live in regular rankings", () => {
    const result = filterVideosByRankingContentFormat(mixed, "regular");
    expect(result.map((video) => video.id)).toEqual(["regular"]);
    expect(countRankingShorts(result)).toBe(0);
    expect(countRankingLive(result)).toBe(0);
  });

  it("shows only shorts in shorts ranking", () => {
    const result = filterVideosByRankingContentFormat(mixed, "short");
    expect(
      result.every((video) => matchesVideoRankingContentFormat(video, "short")),
    ).toBe(true);
    expect(result.map((video) => video.id)).toEqual(["short-flag", "misclassified-short"]);
  });

  it("shows only live videos in live ranking", () => {
    const result = filterVideosByRankingContentFormat(mixed, "live");
    expect(result.every((video) => video.contentKind === "live")).toBe(true);
  });

  it("excludes unknown short-duration videos from regular rankings", () => {
    expect(
      matchesVideoRankingContentFormat(
        makeVideo({ contentKind: "unknown", durationSeconds: 42 }),
        "regular",
      ),
    ).toBe(false);
  });
});
