import { describe, expect, it } from "vitest";

import { classifyYouTubeVideoItem } from "@/lib/discovery/videoClassification";
import { computeVideoContentFeatures } from "@/lib/discovery/videoFeatures";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

function makeItem(overrides: Partial<YouTubeVideoItem> = {}): YouTubeVideoItem {
  return {
    id: "video1234567",
    snippet: {
      title: "なぜこれは伸びる？2026",
      description: "テスト説明",
      publishedAt: "2026-07-26T15:00:00.000Z",
      channelId: "UC1234567890abcdefghij",
      channelTitle: "Sample Channel",
      tags: ["tag1", "tag2"],
      liveBroadcastContent: "none",
      thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
    },
    statistics: {
      viewCount: "1000",
      likeCount: "100",
      commentCount: "10",
    },
    contentDetails: { duration: "PT45S" },
    ...overrides,
  };
}

describe("videoClassification", () => {
  it("classifies shorts, live, and regular videos", () => {
    expect(classifyYouTubeVideoItem(makeItem()).contentKind).toBe("short");
    expect(
      classifyYouTubeVideoItem(
        makeItem({
          contentDetails: { duration: "PT10M" },
          snippet: {
            ...makeItem().snippet,
            liveBroadcastContent: "live",
          },
        }),
      ).contentKind,
    ).toBe("live");
    expect(
      classifyYouTubeVideoItem(makeItem({ contentDetails: { duration: "PT10M" } }))
        .contentKind,
    ).toBe("regular");
  });
});

describe("videoContentFeatures", () => {
  it("extracts title and publish-time features", () => {
    const features = computeVideoContentFeatures({
      title: "なぜこれは伸びる？2026",
      description: "テスト",
      publishedAt: "2026-07-26T15:00:00.000Z",
      durationSeconds: 45,
      tags: ["a", "b"],
    });

    expect(features).toMatchObject({
      titleLength: expect.any(Number),
      hasNumberInTitle: true,
      isQuestionTitle: true,
      tagCount: 2,
      publishedHourJst: 0,
    });
  });
});
