import { computeCandidatePromotionState } from "@/lib/promotion/classifier";
import {
  computePromotionMetrics,
  type PromotionMetrics,
} from "@/lib/promotion/metrics";
import {
  getYouTubeCategoryId,
  KNOWN_CATEGORY_IDS,
} from "@/lib/youtube/categories";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import { getPublishedAfter } from "@/lib/ranking/periods";
import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { VideoRow, VideoSnapshotRow } from "@/types/database";
import type { GenreId, RankingPeriod, Video } from "@/types";
import type { PromotionState } from "@/types/observability";

export interface SnapshotEnrichedVideo {
  video: Video;
  snapshots: VideoSnapshotRow[];
  promotionMetrics: PromotionMetrics | null;
  promotionState: PromotionState | null;
}

export async function enrichVideosWithSnapshots(
  videos: Video[],
): Promise<SnapshotEnrichedVideo[]> {
  if (!isSupabaseConfigured() || videos.length === 0) {
    return videos.map((video) => ({
      video,
      snapshots: [],
      promotionMetrics: null,
      promotionState: null,
    }));
  }

  const snapshotsByVideo = await fetchSnapshotsForVideos(videos.map((video) => video.id));

  return videos.map((video) => {
    const snapshots = snapshotsByVideo.get(video.id) ?? [];

    if (snapshots.length < 2) {
      return {
        video,
        snapshots,
        promotionMetrics: null,
        promotionState: null,
      };
    }

    const latestSnapshot = snapshots.at(-1);
    const subscriberCount =
      latestSnapshot?.subscriber_count ??
      (video.channel.subscriberCountHidden ? null : video.channel.subscriberCount);

    const promotionMetrics = computePromotionMetrics({
      videoId: video.id,
      snapshots,
      currentViewCount: latestSnapshot?.view_count ?? video.viewCount,
      subscriberCount,
      subscriberCountHidden: video.channel.subscriberCountHidden,
      firstDiscoveredAt: null,
    });

    const candidate = computeCandidatePromotionState(
      promotionMetrics,
      latestSnapshot?.view_count ?? video.viewCount,
    );

    return {
      video,
      snapshots,
      promotionMetrics,
      promotionState: candidate.state,
    };
  });
}

export function getMeasuredPromotionVideos(
  enriched: SnapshotEnrichedVideo[],
): SnapshotEnrichedVideo[] {
  return enriched.filter(
    (entry) =>
      entry.promotionMetrics !== null &&
      entry.promotionMetrics.snapshotQuality === "measured" &&
      entry.promotionMetrics.v1h !== null,
  );
}

export function getPublishedAgeHours(publishedAt: string, referenceMs = Date.now()): number {
  return Math.max(0, (referenceMs - Date.parse(publishedAt)) / (60 * 60 * 1000));
}

function matchesGenre(categoryId: string | null, genre: GenreId): boolean {
  if (genre === "all") {
    return true;
  }

  if (genre === "other") {
    return categoryId !== null && !KNOWN_CATEGORY_IDS.includes(categoryId);
  }

  return categoryId === getYouTubeCategoryId(genre);
}

function mapVideoRowToCandidate(
  row: VideoRow,
  latestSnapshot: VideoSnapshotRow | undefined,
  period: RankingPeriod,
): Video {
  const subscriberCountHidden = false;

  return {
    id: row.youtube_video_id,
    title: row.title ?? row.youtube_video_id,
    thumbnailUrl: row.thumbnail_url ?? "",
    publishedAt: row.published_at ?? new Date().toISOString(),
    channel: {
      id: row.channel_id ?? "",
      name: row.channel_name ?? "",
      subscriberCount: latestSnapshot?.subscriber_count ?? 0,
      subscriberCountHidden,
      thumbnailUrl: undefined,
    },
    viewCount: latestSnapshot?.view_count ?? 0,
    metrics: {
      period,
      viewDelta: 0,
      viewVelocity: 0,
      viewsPerSubscriber: 0,
      rankingScore: 0,
      metricsSource: "estimated",
    },
  };
}

export async function getBuzzRankingCandidatesFromDb(
  period: RankingPeriod,
  genre: GenreId,
): Promise<Video[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const publishedAfter = getPublishedAfter(period);

  const { data: videoRows, error } = await supabase
    .from("videos")
    .select("*")
    .eq("is_active", true)
    .gte("published_at", publishedAfter)
    .order("last_seen_at", { ascending: false })
    .limit(OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert);

  if (error) {
    throw new Error(`videos lookup failed: ${error.message}`);
  }

  const rows = (videoRows ?? []) as VideoRow[];
  if (rows.length === 0) {
    return [];
  }

  const snapshotsByVideo = await fetchSnapshotsForVideos(
    rows.map((row) => row.youtube_video_id),
  );

  return rows
    .filter((row) => matchesGenre(row.category_id, genre))
    .map((row) =>
      mapVideoRowToCandidate(
        row,
        snapshotsByVideo.get(row.youtube_video_id)?.at(-1),
        period,
      ),
    );
}

export async function getMeasuredRankingCandidates(
  period: RankingPeriod,
  genre: GenreId,
): Promise<Video[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const { data: snapshotRows, error: snapshotError } = await supabase
    .from("video_snapshots")
    .select("video_id");

  if (snapshotError) {
    throw new Error(`video_snapshots lookup failed: ${snapshotError.message}`);
  }

  const snapshotCounts = new Map<string, number>();
  for (const row of snapshotRows ?? []) {
    snapshotCounts.set(row.video_id, (snapshotCounts.get(row.video_id) ?? 0) + 1);
  }

  const videoIds = [...snapshotCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([videoId]) => videoId);

  if (videoIds.length === 0) {
    return [];
  }

  const { data: videoRows, error: videoError } = await supabase
    .from("videos")
    .select("*")
    .in("youtube_video_id", videoIds);

  if (videoError) {
    throw new Error(`videos lookup failed: ${videoError.message}`);
  }

  const snapshotsByVideo = await fetchSnapshotsForVideos(videoIds);

  return (videoRows ?? [])
    .filter((row) => matchesGenre(row.category_id, genre))
    .map((row) =>
      mapVideoRowToCandidate(
        row as VideoRow,
        snapshotsByVideo.get(row.youtube_video_id)?.at(-1),
        period,
      ),
    );
}
