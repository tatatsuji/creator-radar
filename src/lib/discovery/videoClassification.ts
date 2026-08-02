import { isTopicChannelName } from "@/lib/youtube/filters";
import {
  classifyYouTubeVideoContent,
  type VideoFormatClassification,
} from "@/lib/discovery/videoFormatClassification";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

export type VideoContentKind = "regular" | "short" | "live" | "unknown";

export interface VideoClassification extends VideoFormatClassification {
  isTopicContent: boolean;
  contentKind: VideoContentKind;
}

export function classifyYouTubeVideoItem(
  item: YouTubeVideoItem,
  options?: { verticalConfirmed?: boolean | null },
): VideoClassification {
  const base = classifyYouTubeVideoContent({
    item,
    fetchStatus: "success",
    verticalConfirmed: options?.verticalConfirmed,
  });
  const isTopicContent = isTopicChannelName(item.snippet.channelTitle);

  let contentKind: VideoContentKind = "unknown";
  if (base.liveState === "active") {
    contentKind = "live";
  } else if (base.videoFormat === "short" && base.liveState === "none") {
    contentKind = "short";
  } else if (base.videoFormat === "regular" && base.liveState === "none") {
    contentKind = "regular";
  }

  return {
    ...base,
    isTopicContent,
    contentKind,
  };
}
