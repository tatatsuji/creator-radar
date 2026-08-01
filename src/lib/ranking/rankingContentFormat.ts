import { isShortFormVideo } from "@/lib/youtube/duration";
import type { ContentFormatFilter } from "@/lib/home/contentFormat";
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

export function isRankingLiveVideo(input: {
  isLive?: boolean | null;
}): boolean {
  return input.isLive === true;
}

export function isRankingShortVideo(input: {
  isShort?: boolean | null;
  isLive?: boolean | null;
  durationSeconds?: number | null;
}): boolean {
  if (isRankingLiveVideo(input)) {
    return false;
  }

  if (input.isShort === true) {
    return true;
  }

  if (input.isShort === false) {
    return false;
  }

  const durationSeconds = input.durationSeconds ?? 0;
  return isShortFormVideo(durationSeconds);
}

export function matchesRankingContentFormat(input: {
  isShort?: boolean | null;
  isLive?: boolean | null;
  durationSeconds?: number | null;
  contentFormat: RankingContentFormat;
}): boolean {
  const { contentFormat } = input;
  const isLive = isRankingLiveVideo(input);
  const isShort = isRankingShortVideo(input);

  if (contentFormat === "short") {
    return isShort;
  }

  if (contentFormat === "live") {
    return isLive;
  }

  return !isShort && !isLive;
}

export function matchesVideoRankingContentFormat(
  video: Pick<Video, "contentKind" | "durationSeconds">,
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

  return matchesRankingContentFormat({
    isShort: null,
    isLive: null,
    durationSeconds: video.durationSeconds ?? null,
    contentFormat,
  });
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
