import { buildRankings } from "@/lib/ranking/buildRankings";
import { resolveLatestSnapshotCapturedAt } from "@/lib/ranking/snapshotMetrics";
import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { GenreId, RankingPeriod, Video } from "@/types";
import type { RankingReadiness, RankingType } from "@/types/ranking";

export interface RankingsPayload {
  ranking: RankingType;
  videos: Video[];
  readiness: RankingReadiness;
  metricsSummary: { measured: number; estimated: number };
  updatedAt: string;
  dataFreshnessAt: string | null;
}

export async function getRankingsPayload(
  ranking: RankingType,
  period: RankingPeriod,
  genre: GenreId,
): Promise<RankingsPayload> {
  const built = await buildRankings(ranking, period, genre);
  let dataFreshnessAt: string | null = null;

  if (isSupabaseConfigured() && built.videos.length > 0) {
    const snapshotsByVideo = await fetchSnapshotsForVideos(
      built.videos.map((video) => video.id),
    );
    dataFreshnessAt = resolveLatestSnapshotCapturedAt(snapshotsByVideo);
  }

  return {
    ranking: built.ranking,
    videos: built.videos,
    readiness: built.readiness,
    metricsSummary: built.metricsSummary,
    updatedAt: dataFreshnessAt ?? new Date().toISOString(),
    dataFreshnessAt,
  };
}
