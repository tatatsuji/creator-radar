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
  classificationOverride?: { forceLive?: boolean; forceShort?: boolean };
}): UpsertVideoInput {
  const { item, channel, lastSeenAt, classificationOverride } = input;
  const classification = classifyYouTubeVideoItem(item, classificationOverride);
  const tags = item.snippet.tags ?? [];
  const contentFeatures = computeVideoContentFeatures({
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    durationSeconds: classification.durationSeconds,
    tags,
  });

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
    isTopicContent: classification.isTopicContent,
    viewCount: parseCount(item.statistics?.viewCount),
    likeCount: parseCount(item.statistics?.likeCount) || null,
    commentCount: parseCount(item.statistics?.commentCount) || null,
    tags,
    contentFeatures,
  };
}
