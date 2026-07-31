import { describe, expect, it, vi } from "vitest";

import {
  fetchDiscoveredUploadVideos,
  isInvalidUploadsPlaylistError,
} from "@/lib/discovery/youtubeUploads";

vi.mock("@/lib/youtube/client", () => ({
  youtubeFetch: vi.fn(),
}));

import { youtubeFetch } from "@/lib/youtube/client";

const sampleVideo = {
  id: "video123456",
  snippet: {
    title: "Latest upload",
    channelId: "UC1234567890abcdefghij",
    channelTitle: "Sample",
    publishedAt: "2026-07-24T00:00:00.000Z",
    thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
  },
  contentDetails: { duration: "PT10M30S" },
  statistics: { viewCount: "1000" },
};

describe("isInvalidUploadsPlaylistError", () => {
  it("detects invalid playlist API errors", () => {
    expect(
      isInvalidUploadsPlaylistError(new Error("Invalid Value: playlistId")),
    ).toBe(true);
    expect(
      isInvalidUploadsPlaylistError(new Error("Playlist not found")),
    ).toBe(true);
    expect(isInvalidUploadsPlaylistError(new Error("Network timeout"))).toBe(
      false,
    );
  });
});

describe("fetchDiscoveredUploadVideos", () => {
  const channelId = "UC1234567890abcdefghij";

  it("skips channels.list when uploads_playlist_id is cached", async () => {
    const fetchChannelUploadsPlaylistId = vi.fn();
    const fetchLatestUploadVideoIds = vi
      .fn()
      .mockResolvedValue(["video123456"]);

    vi.mocked(youtubeFetch).mockResolvedValueOnce({
      items: [sampleVideo],
    });

    const result = await fetchDiscoveredUploadVideos(channelId, 5, {
      getCachedUploadsPlaylistId: vi.fn().mockResolvedValue("UUcached123"),
      saveUploadsPlaylistId: vi.fn(),
      clearUploadsPlaylistId: vi.fn(),
      fetchChannelUploadsPlaylistId,
      fetchLatestUploadVideoIds,
    });

    expect(result.items).toHaveLength(1);
    expect(result.quotaUsed).toBe(2);
    expect(fetchChannelUploadsPlaylistId).not.toHaveBeenCalled();
    expect(fetchLatestUploadVideoIds).toHaveBeenCalledWith("UUcached123", 5);
  });

  it("fetches and saves uploads_playlist_id when cache is missing", async () => {
    const saveUploadsPlaylistId = vi.fn().mockResolvedValue(undefined);
    const fetchChannelUploadsPlaylistId = vi
      .fn()
      .mockResolvedValue("UUfresh456");
    const fetchLatestUploadVideoIds = vi.fn().mockResolvedValue([]);

    const result = await fetchDiscoveredUploadVideos(channelId, 5, {
      getCachedUploadsPlaylistId: vi.fn().mockResolvedValue(null),
      saveUploadsPlaylistId,
      clearUploadsPlaylistId: vi.fn(),
      fetchChannelUploadsPlaylistId,
      fetchLatestUploadVideoIds,
    });

    expect(result.items).toEqual([]);
    expect(result.quotaUsed).toBe(2);
    expect(fetchChannelUploadsPlaylistId).toHaveBeenCalledWith(channelId);
    expect(saveUploadsPlaylistId).toHaveBeenCalledWith(channelId, "UUfresh456");
  });

  it("clears invalid cache and retries channels.list at most once", async () => {
    const clearUploadsPlaylistId = vi.fn().mockResolvedValue(undefined);
    const saveUploadsPlaylistId = vi.fn().mockResolvedValue(undefined);
    const fetchChannelUploadsPlaylistId = vi
      .fn()
      .mockResolvedValue("UUvalid789");
    const fetchLatestUploadVideoIds = vi
      .fn()
      .mockRejectedValueOnce(new Error("Invalid Value: playlistId"))
      .mockResolvedValueOnce(["video123456"]);

    vi.mocked(youtubeFetch).mockResolvedValueOnce({
      items: [sampleVideo],
    });

    const result = await fetchDiscoveredUploadVideos(channelId, 5, {
      getCachedUploadsPlaylistId: vi.fn().mockResolvedValue("UUstale"),
      saveUploadsPlaylistId,
      clearUploadsPlaylistId,
      fetchChannelUploadsPlaylistId,
      fetchLatestUploadVideoIds,
    });

    expect(result.items).toHaveLength(1);
    expect(result.quotaUsed).toBe(3);
    expect(clearUploadsPlaylistId).toHaveBeenCalledWith(channelId);
    expect(fetchChannelUploadsPlaylistId).toHaveBeenCalledTimes(1);
    expect(saveUploadsPlaylistId).toHaveBeenCalledWith(channelId, "UUvalid789");
    expect(fetchLatestUploadVideoIds).toHaveBeenCalledTimes(2);
  });

  it("does not retry invalid playlist errors infinitely", async () => {
    const fetchChannelUploadsPlaylistId = vi.fn().mockResolvedValue("UUinvalid");
    const fetchLatestUploadVideoIds = vi
      .fn()
      .mockRejectedValue(new Error("Invalid Value: playlistId"));

    await expect(
      fetchDiscoveredUploadVideos(channelId, 5, {
        getCachedUploadsPlaylistId: vi.fn().mockResolvedValue("UUstale"),
        saveUploadsPlaylistId: vi.fn(),
        clearUploadsPlaylistId: vi.fn(),
        fetchChannelUploadsPlaylistId,
        fetchLatestUploadVideoIds,
      }),
    ).rejects.toThrow("Invalid Value: playlistId");

    expect(fetchChannelUploadsPlaylistId).toHaveBeenCalledTimes(1);
    expect(fetchLatestUploadVideoIds).toHaveBeenCalledTimes(2);
  });
});
