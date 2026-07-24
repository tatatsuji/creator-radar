import { getCollectTargetVideoItems } from "@/lib/youtube/rankings";
import type { YouTubeVideoItem } from "@/lib/youtube/types";

import {
  insertVideoSnapshot,
  upsertVideoRecord,
} from "@/lib/snapshots/repository";

function parseCount(value?: string): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickThumbnail(item: YouTubeVideoItem): string {
  const thumbnails = item.snippet.thumbnails;
  return (
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    "/placeholder-thumbnail.svg"
  );
}

export interface CollectSnapshotsResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ videoId: string; message: string }>;
}

export async function collectVideoSnapshots(): Promise<CollectSnapshotsResult> {
  const videoItems = await getCollectTargetVideoItems();
  const errors: CollectSnapshotsResult["errors"] = [];
  let success = 0;
  let failed = 0;

  for (const item of videoItems) {
    try {
      await upsertVideoRecord({
        youtubeVideoId: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelName: item.snippet.channelTitle,
        thumbnailUrl: pickThumbnail(item),
        publishedAt: item.snippet.publishedAt,
        categoryId: item.snippet.categoryId,
      });

      await insertVideoSnapshot({
        videoId: item.id,
        viewCount: parseCount(item.statistics?.viewCount),
        likeCount: parseCount(item.statistics?.likeCount),
        commentCount: parseCount(item.statistics?.commentCount),
      });

      success += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        videoId: item.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    total: videoItems.length,
    success,
    failed,
    errors,
  };
}
