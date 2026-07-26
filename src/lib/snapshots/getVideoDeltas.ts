import {
  DELTA_WINDOWS,
  getDeltaWindowHours,
  type DeltaWindow,
} from "@/lib/snapshots/deltaWindows";
import { computeMeasuredSnapshotDelta } from "@/lib/snapshots/measuredDelta";
import { fetchSnapshotsForVideo } from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getVideoById } from "@/lib/youtube/rankings";

export interface VideoDeltaEntry {
  window: DeltaWindow;
  label: string;
  status: "measured" | "insufficient";
  viewDelta: number | null;
  commentDelta: number | null;
  viewVelocity: number | null;
  baselineCapturedAt: string | null;
  latestCapturedAt: string | null;
}

export interface VideoDeltasResponse {
  videoId: string;
  source: "measured" | "insufficient";
  measuredAt: string | null;
  deltas: VideoDeltaEntry[];
}

export async function getVideoDeltas(
  videoId: string,
): Promise<VideoDeltasResponse | null> {
  const video = await getVideoById(videoId, "24h");
  if (!video) {
    return null;
  }

  if (!isSupabaseConfigured()) {
    return buildInsufficientResponse(videoId);
  }

  const snapshots = await fetchSnapshotsForVideo(videoId);
  if (snapshots.length < 2) {
    return buildInsufficientResponse(videoId);
  }

  const deltas: VideoDeltaEntry[] = DELTA_WINDOWS.map((window) => {
    const measured = computeMeasuredSnapshotDelta({
      windowHours: getDeltaWindowHours(window.id),
      snapshots,
      currentViewCount: video.viewCount,
    });

    return {
      window: window.id,
      label: window.label,
      status: measured.status,
      viewDelta: measured.viewDelta,
      commentDelta: measured.commentDelta,
      viewVelocity: measured.viewVelocity,
      baselineCapturedAt: measured.baselineCapturedAt,
      latestCapturedAt: measured.latestCapturedAt,
    };
  });

  const hasMeasured = deltas.some((delta) => delta.status === "measured");
  const latestCapturedAt = snapshots.at(-1)?.captured_at ?? null;

  return {
    videoId,
    source: hasMeasured ? "measured" : "insufficient",
    measuredAt: latestCapturedAt,
    deltas,
  };
}

function buildInsufficientResponse(videoId: string): VideoDeltasResponse {
  return {
    videoId,
    source: "insufficient",
    measuredAt: null,
    deltas: DELTA_WINDOWS.map((window) => ({
      window: window.id,
      label: window.label,
      status: "insufficient" as const,
      viewDelta: null,
      commentDelta: null,
      viewVelocity: null,
      baselineCapturedAt: null,
      latestCapturedAt: null,
    })),
  };
}
