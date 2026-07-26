import type { VideoSnapshotRow } from "@/types/database";

const MAX_DRIFT_RATIO = 0.25;

export type MeasuredDataStatus = "measured" | "insufficient";

export interface MeasuredSnapshotDelta {
  status: MeasuredDataStatus;
  viewDelta: number | null;
  commentDelta: number | null;
  viewVelocity: number | null;
  baselineCapturedAt: string | null;
  latestCapturedAt: string | null;
}

export function findClosestSnapshot(
  snapshots: VideoSnapshotRow[],
  targetMs: number,
): VideoSnapshotRow | null {
  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.reduce<VideoSnapshotRow | null>((closest, snapshot) => {
    const snapshotMs = new Date(snapshot.captured_at).getTime();
    const diff = Math.abs(snapshotMs - targetMs);

    if (!closest) {
      return snapshot;
    }

    const closestDiff = Math.abs(
      new Date(closest.captured_at).getTime() - targetMs,
    );
    return diff < closestDiff ? snapshot : closest;
  }, null);
}

function getMaxDriftMs(windowHours: number): number {
  return windowHours * 60 * 60 * 1000 * MAX_DRIFT_RATIO;
}

export function computeMeasuredSnapshotDelta(input: {
  windowHours: number;
  snapshots: VideoSnapshotRow[];
  currentViewCount: number;
  now?: Date;
}): MeasuredSnapshotDelta {
  if (input.snapshots.length < 2) {
    return insufficientDelta();
  }

  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const targetMs = nowMs - input.windowHours * 60 * 60 * 1000;
  const baseline = findClosestSnapshot(input.snapshots, targetMs);

  if (!baseline) {
    return insufficientDelta();
  }

  const baselineMs = new Date(baseline.captured_at).getTime();
  const driftMs = Math.abs(baselineMs - targetMs);

  if (driftMs > getMaxDriftMs(input.windowHours) || baselineMs >= nowMs) {
    return insufficientDelta();
  }

  const viewDelta = Math.max(0, input.currentViewCount - baseline.view_count);
  const hoursElapsed = Math.max((nowMs - baselineMs) / (1000 * 60 * 60), 1);
  const viewVelocity = viewDelta / hoursElapsed;
  const commentDelta =
    baseline.comment_count != null
      ? Math.max(0, (input.snapshots.at(-1)?.comment_count ?? 0) - baseline.comment_count)
      : null;

  const latestCapturedAt = input.snapshots.at(-1)?.captured_at ?? null;

  return {
    status: "measured",
    viewDelta,
    commentDelta,
    viewVelocity,
    baselineCapturedAt: baseline.captured_at,
    latestCapturedAt: latestCapturedAt,
  };
}

function insufficientDelta(): MeasuredSnapshotDelta {
  return {
    status: "insufficient",
    viewDelta: null,
    commentDelta: null,
    viewVelocity: null,
    baselineCapturedAt: null,
    latestCapturedAt: null,
  };
}
