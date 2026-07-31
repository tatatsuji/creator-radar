import { describe, expect, it, vi } from "vitest";

import { YouTubeBatchRequestError } from "@/lib/youtube/apiErrors";

import { fetchVideoStatisticsBatch } from "./youtubeStats";

vi.mock("@/lib/youtube/client", () => ({
  youtubeFetch: vi.fn(),
}));

import { youtubeFetch } from "@/lib/youtube/client";

describe("fetchVideoStatisticsBatch", () => {
  it("returns statistics and missing video IDs on successful batch", async () => {
    vi.mocked(youtubeFetch).mockResolvedValue({
      items: [
        {
          id: "video-a",
          statistics: { viewCount: "10", likeCount: "1", commentCount: "0" },
        },
        {
          id: "video-c",
          statistics: { viewCount: "20", likeCount: "2", commentCount: "1" },
        },
      ],
    });

    const result = await fetchVideoStatisticsBatch(["video-a", "video-b", "video-c"]);

    expect(result.statistics).toHaveLength(2);
    expect(result.missingVideoIds).toEqual(["video-b"]);
    expect(result.quotaUsed).toBe(1);
  });

  it("throws classified batch errors without marking videos missing", async () => {
    vi.mocked(youtubeFetch).mockRejectedValue(new Error("quotaExceeded"));

    await expect(fetchVideoStatisticsBatch(["video-a"])).rejects.toBeInstanceOf(
      YouTubeBatchRequestError,
    );
  });
});
