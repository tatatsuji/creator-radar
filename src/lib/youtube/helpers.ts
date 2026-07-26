import type { YouTubeVideoItem } from "@/lib/youtube/types";

export function parseCount(value?: string): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickThumbnail(
  thumbnails: YouTubeVideoItem["snippet"]["thumbnails"],
): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    "/placeholder-thumbnail.svg"
  );
}

export function pickVideoThumbnail(item: YouTubeVideoItem): string {
  return pickThumbnail(item.snippet.thumbnails);
}
