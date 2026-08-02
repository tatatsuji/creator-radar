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
  it("detects shorts from video_format", () => {
    expect(
      isRankingShortVideo({ videoFormat: "short", liveState: "none" }),
    ).toBe(true);
  });

  it("does not treat live streams as shorts", () => {
    expect(
      isRankingShortVideo({ videoFormat: "unknown", liveState: "active" }),
    ).toBe(false);
  });

  it("does not treat unknown format as shorts", () => {
    expect(
      isRankingShortVideo({ videoFormat: "unknown", liveState: "none" }),
    ).toBe(false);
  });
});

describe("matchesRankingContentFormat", () => {
  it("excludes shorts and live from regular rankings", () => {
    expect(
      matchesRankingContentFormat({
        videoFormat: "short",
        liveState: "none",
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        videoFormat: "regular",
        liveState: "active",
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        videoFormat: "unknown",
        liveState: "none",
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        videoFormat: "regular",
        liveState: "none",
        contentFormat: "regular",
      }),
    ).toBe(true);
  });

  it("excludes upcoming and ended live from all pools except active live pool", () => {
    expect(
      matchesRankingContentFormat({
        videoFormat: "regular",
        liveState: "upcoming",
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        videoFormat: "regular",
        liveState: "ended",
        contentFormat: "live",
      }),
    ).toBe(false);
    expect(
      matchesRankingContentFormat({
        videoFormat: "unknown",
        liveState: "active",
        contentFormat: "live",
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
      id: "unknown-short",
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

  it("shows only confirmed shorts in shorts ranking", () => {
    const result = filterVideosByRankingContentFormat(mixed, "short");
    expect(
      result.every((video) => matchesVideoRankingContentFormat(video, "short")),
    ).toBe(true);
    expect(result.map((video) => video.id)).toEqual(["short-flag"]);
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
