import { classifyYouTubeVideoItem } from "@/lib/discovery/videoClassification";
import { computeVideoContentFeatures } from "@/lib/discovery/videoFeatures";
import { pickVideoThumbnail } from "@/lib/youtube/helpers";
import { parseCount } from "@/lib/youtube/helpers";
import type { YouTubeChannelItem, YouTubeVideoItem } from "@/lib/youtube/types";
import type { UpsertChannelInput, UpsertVideoInput } from "@/types/database";

export function buildChannelUpsertFromYouTube(
  channel: YouTubeChannelItem | undefined,
  fallbackChannelId: string,
  fallbackChannelName: string,
): UpsertChannelInput {
  const subscriberCountHidden = channel?.statistics?.hiddenSubscriberCount === true;

  return {
    youtubeChannelId: channel?.id ?? fallbackChannelId,
    name: channel?.snippet.title ?? fallbackChannelName,
    thumbnailUrl: channel?.snippet.thumbnails?.default?.url,
    subscriberCountHidden,
    subscriberCount: subscriberCountHidden
      ? null
      : parseCount(channel?.statistics?.subscriberCount),
  };
}

export function buildVideoUpsertFromYouTubeItem(input: {
  item: YouTubeVideoItem;
  channel?: YouTubeChannelItem;
  lastSeenAt: string;
  verticalConfirmed?: boolean | null;
}): UpsertVideoInput {
  const { item, channel, lastSeenAt, verticalConfirmed } = input;
  const classification = classifyYouTubeVideoItem(item, { verticalConfirmed });
  const tags = item.snippet.tags ?? [];
  const contentFeatures = computeVideoContentFeatures({
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    durationSeconds: classification.durationSeconds,
    tags,
  });
  const checkedAt = new Date().toISOString();

  return {
    youtubeVideoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? null,
    channelId: item.snippet.channelId,
    channelName: channel?.snippet.title ?? item.snippet.channelTitle,
    thumbnailUrl: pickVideoThumbnail(item),
    publishedAt: item.snippet.publishedAt,
    categoryId: item.snippet.categoryId,
    lastSeenAt,
    durationSeconds: classification.durationSeconds,
    isShort: classification.isShort,
    isLive: classification.isLive,
    videoFormat: classification.videoFormat,
    liveState: classification.liveState,
    liveBroadcastContent: classification.liveBroadcastContent,
    liveScheduledStartAt: classification.liveScheduledStartAt,
    liveActualStartAt: classification.liveActualStartAt,
    liveActualEndAt: classification.liveActualEndAt,
    liveMetadataFetchStatus: classification.liveMetadataFetchStatus,
    liveMetadataCheckedAt: checkedAt,
    formatSignals: classification.formatSignals,
    isTopicContent: classification.isTopicContent,
    viewCount: parseCount(item.statistics?.viewCount),
    likeCount: parseCount(item.statistics?.likeCount) || null,
    commentCount: parseCount(item.statistics?.commentCount) || null,
    tags,
    contentFeatures,
  };
}
