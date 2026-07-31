import { WEBSUB_CONFIG } from "@/lib/websub/websubConfig";

const YOUTUBE_TOPIC_PREFIX =
  "https://www.youtube.com/xml/feeds/videos.xml?channel_id=";

export function buildWebsubTopicUrl(youtubeChannelId: string): string {
  return `${YOUTUBE_TOPIC_PREFIX}${youtubeChannelId}`;
}

export function parseChannelIdFromWebsubTopic(topicUrl: string): string | null {
  if (!isValidWebsubTopicUrl(topicUrl)) {
    return null;
  }

  return topicUrl.slice(YOUTUBE_TOPIC_PREFIX.length);
}

export function isValidWebsubTopicUrl(topicUrl: string): boolean {
  return WEBSUB_CONFIG.topicUrlPattern.test(topicUrl);
}
