import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type {
  InsertSnapshotInput,
  UpsertVideoInput,
  VideoSnapshotRow,
} from "@/types/database";

export async function upsertVideoRecord(input: UpsertVideoInput): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("videos").upsert(
    {
      youtube_video_id: input.youtubeVideoId,
      title: input.title,
      channel_id: input.channelId,
      channel_name: input.channelName,
      thumbnail_url: input.thumbnailUrl,
      published_at: input.publishedAt,
      category_id: input.categoryId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "youtube_video_id" },
  );

  if (error) {
    throw new Error(`videos upsert failed: ${error.message}`);
  }
}

export async function insertVideoSnapshot(
  input: InsertSnapshotInput,
): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("video_snapshots").insert({
    video_id: input.videoId,
    view_count: input.viewCount,
    like_count: input.likeCount ?? null,
    comment_count: input.commentCount ?? null,
    captured_at: input.capturedAt ?? new Date().toISOString(),
  });

  if (error) {
    throw new Error(`video_snapshots insert failed: ${error.message}`);
  }
}

export async function fetchSnapshotsForVideos(
  videoIds: string[],
): Promise<Map<string, VideoSnapshotRow[]>> {
  const result = new Map<string, VideoSnapshotRow[]>();

  if (!isSupabaseConfigured() || videoIds.length === 0) {
    return result;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_snapshots")
    .select("id, video_id, view_count, like_count, comment_count, captured_at")
    .in("video_id", videoIds)
    .order("captured_at", { ascending: true });

  if (error) {
    throw new Error(`video_snapshots fetch failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    const snapshots = result.get(row.video_id) ?? [];
    snapshots.push(row as VideoSnapshotRow);
    result.set(row.video_id, snapshots);
  }

  return result;
}
