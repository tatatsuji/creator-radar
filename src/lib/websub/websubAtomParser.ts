import { buildWebsubTopicUrl } from "@/lib/websub/websubTopic";

export interface ParsedWebsubAtomEntry {
  youtubeVideoId: string;
  youtubeChannelId: string;
  topicUrl: string;
  entryUpdatedAt: string | null;
  hubNotificationId: string | null;
}

const ENTRY_BLOCK_PATTERN = /<entry\b[\s\S]*?<\/entry>/gi;
const TAG_VALUE_PATTERN = (tag: string) =>
  new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");

function readTagValue(block: string, tag: string): string | null {
  const match = block.match(TAG_VALUE_PATTERN(tag));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

export function parseWebsubAtomFeed(xml: string): ParsedWebsubAtomEntry[] {
  const entries: ParsedWebsubAtomEntry[] = [];
  const blocks = xml.match(ENTRY_BLOCK_PATTERN) ?? [];

  for (const block of blocks) {
    const youtubeVideoId = readTagValue(block, "yt:videoId");
    const youtubeChannelId = readTagValue(block, "yt:channelId");

    if (!youtubeVideoId || !youtubeChannelId) {
      continue;
    }

    entries.push({
      youtubeVideoId,
      youtubeChannelId,
      topicUrl: buildWebsubTopicUrl(youtubeChannelId),
      entryUpdatedAt: readTagValue(block, "updated"),
      hubNotificationId: readTagValue(block, "id"),
    });
  }

  return entries;
}

export function isWebsubEntryWithinReplayWindow(
  entryUpdatedAt: string | null,
  now: Date,
  maxAgeMs: number,
): boolean {
  if (!entryUpdatedAt) {
    return true;
  }

  const updatedMs = Date.parse(entryUpdatedAt);
  if (!Number.isFinite(updatedMs)) {
    return true;
  }

  return now.getTime() - updatedMs <= maxAgeMs;
}
