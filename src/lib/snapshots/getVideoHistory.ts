import {
  getHistoryRangeHours,
  getHistoryRangeLabel,
  parseHistoryRange,
  type HistoryRange,
} from "@/lib/snapshots/deltaWindows";
import { fetchSnapshotsForVideoInRange } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export interface VideoHistoryPoint {
  capturedAt: string;
  viewCount: number;
  commentCount: number | null;
  likeCount: number | null;
}

export interface VideoHistoryResponse {
  videoId: string;
  range: HistoryRange;
  rangeLabel: string;
  source: "measured" | "insufficient";
  points: VideoHistoryPoint[];
  meta: {
    pointCount: number;
    oldestAt: string | null;
    newestAt: string | null;
  };
}

export async function getVideoHistory(
  videoId: string,
  rangeParam?: string | null,
): Promise<VideoHistoryResponse> {
  const range = parseHistoryRange(rangeParam);
  const rangeHours = getHistoryRangeHours(range);

  if (!isSupabaseConfigured()) {
    return emptyHistory(videoId, range);
  }

  const snapshots = await fetchSnapshotsForVideoInRange(videoId, rangeHours);
  const points: VideoHistoryPoint[] = snapshots.map((snapshot) => ({
    capturedAt: snapshot.captured_at,
    viewCount: snapshot.view_count,
    commentCount: snapshot.comment_count,
    likeCount: snapshot.like_count,
  }));

  const source = points.length >= 2 ? "measured" : "insufficient";

  return {
    videoId,
    range,
    rangeLabel: getHistoryRangeLabel(range),
    source,
    points,
    meta: {
      pointCount: points.length,
      oldestAt: points[0]?.capturedAt ?? null,
      newestAt: points.at(-1)?.capturedAt ?? null,
    },
  };
}

function emptyHistory(videoId: string, range: HistoryRange): VideoHistoryResponse {
  return {
    videoId,
    range,
    rangeLabel: getHistoryRangeLabel(range),
    source: "insufficient",
    points: [],
    meta: {
      pointCount: 0,
      oldestAt: null,
      newestAt: null,
    },
  };
}

export { parseHistoryRange };
