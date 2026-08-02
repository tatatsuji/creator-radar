import { describe, expect, it } from "vitest";

import {
  classifyLiveState,
  classifyVideoFormat,
  classifyYouTubeVideoContent,
  hasShortsHashtag,
  matchesVideoFormatRankingPool,
  resolveContentKindFromClassification,
  SHORTS_MAX_DURATION_SECONDS,
} from "@/lib/discovery/videoFormatClassification";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

function makeItem(overrides: Partial<YouTubeVideoItem> = {}): YouTubeVideoItem {
  return {
    id: "video1234567",
    snippet: {
      title: "Test video",
      description: "",
      publishedAt: "2026-07-26T15:00:00.000Z",
      channelId: "UC1234567890abcdefghij",
      channelTitle: "Sample Channel",
      liveBroadcastContent: "none",
      thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
    },
    contentDetails: { duration: "PT45S" },
    ...overrides,
  };
}

describe("hasShortsHashtag", () => {
  it("detects #shorts in title, description, and tags", () => {
    expect(hasShortsHashtag({ title: "My #shorts clip" })).toBe(true);
    expect(hasShortsHashtag({ description: "watch #Shorts now" })).toBe(true);
    expect(hasShortsHashtag({ tags: ["funny", "#shorts"] })).toBe(true);
    expect(hasShortsHashtag({ title: "Regular video" })).toBe(false);
  });
});

describe("classifyLiveState", () => {
  it("classifies active, upcoming, ended, none, and unknown", () => {
    expect(
      classifyLiveState({
        liveBroadcastContent: "live",
        fetchStatus: "success",
      }),
    ).toBe("active");
    expect(
      classifyLiveState({
        liveBroadcastContent: "upcoming",
        fetchStatus: "success",
      }),
    ).toBe("upcoming");
    expect(
      classifyLiveState({
        liveBroadcastContent: "none",
        liveStreamingDetails: { actualEndTime: "2026-01-01T00:00:00Z" },
        fetchStatus: "success",
      }),
    ).toBe("ended");
    expect(
      classifyLiveState({
        liveBroadcastContent: "none",
        fetchStatus: "success",
      }),
    ).toBe("none");
    expect(
      classifyLiveState({
        liveBroadcastContent: "none",
        fetchStatus: "failed",
      }),
    ).toBe("unknown");
  });
});

describe("classifyVideoFormat", () => {
  it("does not classify short from duration alone", () => {
    expect(
      classifyVideoFormat({
        durationSeconds: 45,
        liveState: "none",
      }),
    ).toBe("unknown");
  });

  it("does not classify short from vertical alone without duration cap evidence path", () => {
    expect(
      classifyVideoFormat({
        durationSeconds: 45,
        liveState: "none",
        verticalConfirmed: false,
      }),
    ).toBe("unknown");
  });

  it("classifies short with hashtag and duration within cap", () => {
    expect(
      classifyVideoFormat({
        durationSeconds: SHORTS_MAX_DURATION_SECONDS,
        title: "Clip #shorts",
        liveState: "none",
      }),
    ).toBe("short");
  });

  it("classifies short with vertical confirmation and duration within cap", () => {
    expect(
      classifyVideoFormat({
        durationSeconds: 90,
        liveState: "none",
        verticalConfirmed: true,
      }),
    ).toBe("short");
  });

  it("classifies regular when duration exceeds cap and live_state is none", () => {
    expect(
      classifyVideoFormat({
        durationSeconds: SHORTS_MAX_DURATION_SECONDS + 1,
        liveState: "none",
      }),
    ).toBe("regular");
  });

  it("returns unknown for any non-none live_state", () => {
    expect(
      classifyVideoFormat({
        durationSeconds: 600,
        liveState: "active",
      }),
    ).toBe("unknown");
  });
});

describe("classifyYouTubeVideoContent", () => {
  it("integrates live and format classification from API item", () => {
    const short = classifyYouTubeVideoContent({
      item: makeItem({ snippet: { ...makeItem().snippet, title: "Fun #shorts" } }),
    });
    expect(short.videoFormat).toBe("short");
    expect(short.liveState).toBe("none");

    const live = classifyYouTubeVideoContent({
      item: makeItem({
        snippet: { ...makeItem().snippet, liveBroadcastContent: "live" },
      }),
    });
    expect(live.liveState).toBe("active");
    expect(live.videoFormat).toBe("unknown");
  });
});

describe("ranking pool matching", () => {
  it("includes only active live in live pool", () => {
    expect(
      matchesVideoFormatRankingPool({
        videoFormat: "unknown",
        liveState: "active",
        contentFormat: "live",
      }),
    ).toBe(true);
    expect(
      matchesVideoFormatRankingPool({
        videoFormat: "regular",
        liveState: "upcoming",
        contentFormat: "live",
      }),
    ).toBe(false);
  });

  it("excludes unknown format and non-none live from regular/short pools", () => {
    expect(
      matchesVideoFormatRankingPool({
        videoFormat: "unknown",
        liveState: "none",
        contentFormat: "regular",
      }),
    ).toBe(false);
    expect(
      matchesVideoFormatRankingPool({
        videoFormat: "short",
        liveState: "none",
        contentFormat: "short",
      }),
    ).toBe(true);
    expect(
      matchesVideoFormatRankingPool({
        videoFormat: "regular",
        liveState: "ended",
        contentFormat: "regular",
      }),
    ).toBe(false);
  });

  it("resolves content kind for ranking display", () => {
    expect(
      resolveContentKindFromClassification({
        videoFormat: "regular",
        liveState: "none",
      }),
    ).toBe("regular");
    expect(
      resolveContentKindFromClassification({
        videoFormat: "unknown",
        liveState: "none",
      }),
    ).toBe("unknown");
  });
});
