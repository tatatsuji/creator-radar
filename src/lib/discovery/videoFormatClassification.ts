import { parseIsoDurationSeconds } from "@/lib/youtube/duration";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

export type VideoFormat = "short" | "regular" | "unknown";
export type LiveState = "none" | "active" | "upcoming" | "ended" | "unknown";
export type LiveMetadataFetchStatus = "success" | "failed" | "not_checked";

export const SHORTS_MAX_DURATION_SECONDS = 180;

export interface VideoFormatClassification {
  durationSeconds: number;
  videoFormat: VideoFormat;
  liveState: LiveState;
  liveBroadcastContent: string | null;
  liveScheduledStartAt: string | null;
  liveActualStartAt: string | null;
  liveActualEndAt: string | null;
  liveMetadataFetchStatus: LiveMetadataFetchStatus;
  formatSignals: Record<string, unknown>;
  /** @deprecated migration compat — derived from videoFormat / liveState */
  isShort: boolean | null;
  /** @deprecated migration compat — derived from liveState */
  isLive: boolean | null;
}

const SHORTS_HASHTAG = /#shorts\b/i;

export function hasShortsHashtag(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
}): boolean {
  const haystack = [
    input.title ?? "",
    input.description ?? "",
    ...(input.tags ?? []),
  ].join("\n");
  return SHORTS_HASHTAG.test(haystack);
}

export function classifyLiveState(input: {
  liveBroadcastContent?: string | null;
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
  } | null;
  fetchStatus: LiveMetadataFetchStatus;
}): LiveState {
  if (input.fetchStatus !== "success") {
    return "unknown";
  }

  const broadcast = input.liveBroadcastContent ?? "none";
  const liveDetails = input.liveStreamingDetails;

  if (broadcast === "live") {
    return "active";
  }

  if (broadcast === "upcoming") {
    return "upcoming";
  }

  if (liveDetails?.actualEndTime) {
    return "ended";
  }

  if (broadcast === "none") {
    return "none";
  }

  return "unknown";
}

export function classifyVideoFormat(input: {
  durationSeconds: number;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  liveState: LiveState;
  verticalConfirmed?: boolean | null;
}): VideoFormat {
  if (input.liveState !== "none") {
    return "unknown";
  }

  const durationSeconds = input.durationSeconds;
  if (durationSeconds <= 0) {
    return "unknown";
  }

  const withinShortsDuration = durationSeconds <= SHORTS_MAX_DURATION_SECONDS;

  if (
    withinShortsDuration &&
    hasShortsHashtag({
      title: input.title,
      description: input.description,
      tags: input.tags,
    })
  ) {
    return "short";
  }

  if (withinShortsDuration && input.verticalConfirmed === true) {
    return "short";
  }

  if (durationSeconds > SHORTS_MAX_DURATION_SECONDS) {
    return "regular";
  }

  return "unknown";
}

export function toLegacyShortFlag(videoFormat: VideoFormat): boolean | null {
  if (videoFormat === "short") {
    return true;
  }
  if (videoFormat === "regular") {
    return false;
  }
  return null;
}

export function toLegacyLiveFlag(liveState: LiveState): boolean | null {
  if (liveState === "active" || liveState === "upcoming") {
    return true;
  }
  if (liveState === "none" || liveState === "ended") {
    return false;
  }
  return null;
}

export function classifyYouTubeVideoContent(input: {
  item: YouTubeVideoItem;
  fetchStatus?: LiveMetadataFetchStatus;
  verticalConfirmed?: boolean | null;
}): VideoFormatClassification {
  const { item } = input;
  const fetchStatus = input.fetchStatus ?? "success";
  const durationSeconds = parseIsoDurationSeconds(item.contentDetails?.duration);
  const liveDetails = item.liveStreamingDetails ?? null;
  const liveBroadcastContent = item.snippet.liveBroadcastContent ?? "none";

  const liveState = classifyLiveState({
    liveBroadcastContent,
    liveStreamingDetails: liveDetails,
    fetchStatus,
  });

  const videoFormat = classifyVideoFormat({
    durationSeconds,
    title: item.snippet.title,
    description: item.snippet.description,
    tags: item.snippet.tags,
    liveState,
    verticalConfirmed: input.verticalConfirmed,
  });

  const formatSignals: Record<string, unknown> = {
    hasShortsHashtag: hasShortsHashtag({
      title: item.snippet.title,
      description: item.snippet.description,
      tags: item.snippet.tags,
    }),
    verticalConfirmed: input.verticalConfirmed ?? null,
    durationSeconds,
    liveBroadcastContent,
    hasLiveStreamingDetails: liveDetails != null,
  };

  return {
    durationSeconds,
    videoFormat,
    liveState,
    liveBroadcastContent,
    liveScheduledStartAt: liveDetails?.scheduledStartTime ?? null,
    liveActualStartAt: liveDetails?.actualStartTime ?? null,
    liveActualEndAt: liveDetails?.actualEndTime ?? null,
    liveMetadataFetchStatus: fetchStatus,
    formatSignals,
    isShort: toLegacyShortFlag(videoFormat),
    isLive: toLegacyLiveFlag(liveState),
  };
}

export function resolveContentKindFromClassification(input: {
  videoFormat?: VideoFormat | null;
  liveState?: LiveState | null;
}): "regular" | "short" | "live" | "unknown" {
  if (input.liveState === "active") {
    return "live";
  }
  if (input.videoFormat === "short" && input.liveState === "none") {
    return "short";
  }
  if (input.videoFormat === "regular" && input.liveState === "none") {
    return "regular";
  }
  return "unknown";
}

export function matchesVideoFormatRankingPool(input: {
  videoFormat?: VideoFormat | null;
  liveState?: LiveState | null;
  contentFormat: "regular" | "short" | "live";
}): boolean {
  const { videoFormat, liveState, contentFormat } = input;

  if (contentFormat === "live") {
    return liveState === "active";
  }

  if (liveState !== "none") {
    return false;
  }

  if (contentFormat === "short") {
    return videoFormat === "short";
  }

  return videoFormat === "regular";
}
