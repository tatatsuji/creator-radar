import type { ContentFormatFilter } from "@/lib/home/contentFormat";
import {
  matchesVideoFormatRankingPool,
  resolveContentKindFromClassification,
  type LiveState,
  type VideoFormat,
} from "@/lib/discovery/videoFormatClassification";
import type { GenreId, Video } from "@/types";

/** Content pool used when building ranking candidate lists. */
export type RankingContentFormat = "regular" | "short" | "live";

export function resolveRankingContentFormat(input: {
  genre: GenreId;
  format: ContentFormatFilter;
}): RankingContentFormat {
  if (input.genre === "shorts" || input.format === "short") {
    return "short";
  }

  if (input.format === "live") {
    return "live";
  }

  return "regular";
}

export function matchesRankingContentFormat(input: {
  videoFormat?: VideoFormat | null;
  liveState?: LiveState | null;
  contentFormat: RankingContentFormat;
}): boolean {
  return matchesVideoFormatRankingPool({
    videoFormat: input.videoFormat,
    liveState: input.liveState,
    contentFormat: input.contentFormat,
  });
}

export function matchesVideoRankingContentFormat(
  video: Pick<Video, "contentKind">,
  contentFormat: RankingContentFormat,
): boolean {
  if (video.contentKind === "short") {
    return contentFormat === "short";
  }

  if (video.contentKind === "live") {
    return contentFormat === "live";
  }

  if (video.contentKind === "regular") {
    return contentFormat === "regular";
  }

  return false;
}

export function filterVideosByRankingContentFormat(
  videos: Video[],
  contentFormat: RankingContentFormat,
): Video[] {
  return videos.filter((video) =>
    matchesVideoRankingContentFormat(video, contentFormat),
  );
}

export function countRankingShorts(videos: Video[]): number {
  return videos.filter((video) =>
    matchesVideoRankingContentFormat(video, "short"),
  ).length;
}

export function countRankingLive(videos: Video[]): number {
  return videos.filter((video) =>
    matchesVideoRankingContentFormat(video, "live"),
  ).length;
}

export function resolveVideoContentKindFromRow(input: {
  videoFormat?: VideoFormat | null;
  liveState?: LiveState | null;
}): Video["contentKind"] {
  return resolveContentKindFromClassification(input);
}

/** @deprecated use matchesRankingContentFormat with videoFormat/liveState */
export function isRankingLiveVideo(input: {
  liveState?: LiveState | null;
}): boolean {
  return input.liveState === "active";
}

/** @deprecated use matchesRankingContentFormat with videoFormat/liveState */
export function isRankingShortVideo(input: {
  videoFormat?: VideoFormat | null;
  liveState?: LiveState | null;
}): boolean {
  return (
    input.liveState === "none" && input.videoFormat === "short"
  );
}
