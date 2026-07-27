import { isTopicChannelName } from "@/lib/youtube/filters";
import {
  isShortFormVideo,
  parseIsoDurationSeconds,
} from "@/lib/youtube/duration";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

export type VideoContentKind = "regular" | "short" | "live";

export interface VideoClassification {
  durationSeconds: number;
  isShort: boolean;
  isLive: boolean;
  isTopicContent: boolean;
  contentKind: VideoContentKind;
}

export function classifyYouTubeVideoItem(
  item: YouTubeVideoItem,
  options?: { forceLive?: boolean; forceShort?: boolean },
): VideoClassification {
  const durationSeconds = parseIsoDurationSeconds(item.contentDetails?.duration);
  const liveBroadcast = item.snippet.liveBroadcastContent;
  const isLive =
    options?.forceLive === true ||
    liveBroadcast === "live" ||
    liveBroadcast === "upcoming";
  const isShort =
    options?.forceShort === true ||
    (!isLive && isShortFormVideo(durationSeconds));
  const isTopicContent = isTopicChannelName(item.snippet.channelTitle);

  let contentKind: VideoContentKind = "regular";
  if (isLive) {
    contentKind = "live";
  } else if (isShort) {
    contentKind = "short";
  }

  return {
    durationSeconds,
    isShort,
    isLive,
    isTopicContent,
    contentKind,
  };
}
