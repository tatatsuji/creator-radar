import { computePromotionMetrics } from "@/lib/promotion/metrics";
import { fetchSnapshotsForVideo } from "@/lib/snapshots/repository";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { VideoRow } from "@/types/database";
import type { RankingPeriod, Video } from "@/types";

import { buildEngagementStats } from "./facts";
import type { VideoAnalysisInput } from "./types";

export async function buildVideoAnalysisInput(
  video: Video,
  period: RankingPeriod,
): Promise<VideoAnalysisInput> {
  let likeCount: number | null = null;
  let commentCount: number | null = null;

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("videos")
      .select("view_count, like_count, comment_count")
      .eq("youtube_video_id", video.id)
      .maybeSingle();

    if (data) {
      const row = data as Pick<
        VideoRow,
        "view_count" | "like_count" | "comment_count"
      >;
      likeCount = row.like_count;
      commentCount = row.comment_count;
    }
  }

  const snapshots = await fetchSnapshotsForVideo(video.id);
  const latestSnapshot = snapshots.at(-1);

  const engagement = buildEngagementStats(
    latestSnapshot?.view_count ?? video.viewCount,
    likeCount ?? latestSnapshot?.like_count,
    commentCount ?? latestSnapshot?.comment_count,
  );

  let promotionMetrics = null;
  if (snapshots.length >= 2) {
    promotionMetrics = computePromotionMetrics({
      videoId: video.id,
      snapshots,
      currentViewCount: latestSnapshot?.view_count ?? video.viewCount,
      subscriberCount: video.channel.subscriberCountHidden
        ? null
        : video.channel.subscriberCount,
      subscriberCountHidden: video.channel.subscriberCountHidden,
      firstDiscoveredAt: null,
    });
  }

  return {
    video: { ...video, metrics: { ...video.metrics, period } },
    period,
    engagement,
    promotionMetrics,
  };
}
