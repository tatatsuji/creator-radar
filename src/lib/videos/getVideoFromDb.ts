import { finalizeRankedVideos } from "@/lib/ranking/metrics";
import { mergeSnapshotMetricsIntoVideos } from "@/lib/ranking/snapshotMetrics";
import { mapVideoRowToVideo } from "@/lib/ranking/snapshotRankingBase";
import { fetchSnapshotsForVideo } from "@/lib/snapshots/repository";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { VideoRow } from "@/types/database";
import type { RankingPeriod, Video } from "@/types";

/**
 * DB-first video lookup for page views. Never calls YouTube API.
 */
export async function getVideoByIdFromDb(
  videoId: string,
  period: RankingPeriod = "24h",
): Promise<Video | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("videos")
    .select("*")
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (error) {
    throw new Error(`videos lookup failed: ${error.message}`);
  }

  if (!row) {
    return null;
  }

  const snapshots = await fetchSnapshotsForVideo(videoId);
  const baseVideo = mapVideoRowToVideo(
    row as VideoRow,
    snapshots.at(-1),
    period,
  );

  const { videos: merged } = await mergeSnapshotMetricsIntoVideos(
    [
      {
        ...baseVideo,
        metrics: {
          ...baseVideo.metrics,
          rawScore: baseVideo.metrics.rankingScore,
        },
      },
    ],
    period,
  );

  const [finalized] = await finalizeRankedVideos(merged, period);
  return finalized ?? merged[0] ?? baseVideo;
}
