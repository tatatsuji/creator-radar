import type { VideoSnapshotRow } from "@/types/database";

export type VelocityWindowHours = 1 | 3 | 6 | 24;

export type VelocityQuality = "measured" | "estimated" | "unavailable";

export interface VelocitySample {
  windowHours: VelocityWindowHours;
  quality: VelocityQuality;
  viewsPerHour: number | null;
  viewDelta: number | null;
  elapsedHours: number | null;
  startCapturedAt: string | null;
  endCapturedAt: string | null;
  reason?: string;
}

export interface VelocityAnalysis {
  videoId: string;
  snapshotCount: number;
  firstCapturedAt: string | null;
  lastCapturedAt: string | null;
  samples: VelocitySample[];
}

function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / (60 * 60 * 1000);
}

function findSnapshotAtOrBefore(
  snapshots: VideoSnapshotRow[],
  targetMs: number,
): VideoSnapshotRow | null {
  let candidate: VideoSnapshotRow | null = null;
  for (const snapshot of snapshots) {
    const capturedMs = Date.parse(snapshot.captured_at);
    if (capturedMs <= targetMs) {
      candidate = snapshot;
    } else {
      break;
    }
  }
  return candidate;
}

function findSnapshotAtOrAfter(
  snapshots: VideoSnapshotRow[],
  targetMs: number,
): VideoSnapshotRow | null {
  for (const snapshot of snapshots) {
    if (Date.parse(snapshot.captured_at) >= targetMs) {
      return snapshot;
    }
  }
  return null;
}

export function computeVelocitySample(
  snapshots: VideoSnapshotRow[],
  windowHours: VelocityWindowHours,
  referenceEndMs: number = Date.now(),
): VelocitySample {
  if (snapshots.length < 2) {
    return {
      windowHours,
      quality: "unavailable",
      viewsPerHour: null,
      viewDelta: null,
      elapsedHours: null,
      startCapturedAt: snapshots[0]?.captured_at ?? null,
      endCapturedAt: snapshots.at(-1)?.captured_at ?? null,
      reason: "insufficient_snapshots",
    };
  }

  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );
  const endSnapshot = findSnapshotAtOrBefore(sorted, referenceEndMs) ?? sorted.at(-1)!;
  const endMs = Date.parse(endSnapshot.captured_at);
  const targetStartMs = endMs - windowHours * 60 * 60 * 1000;

  const exactStart = findSnapshotAtOrBefore(sorted, targetStartMs);
  const nearestAfter = findSnapshotAtOrAfter(sorted, targetStartMs);

  let startSnapshot = exactStart;
  let quality: VelocityQuality = "measured";

  if (!startSnapshot) {
    startSnapshot = sorted[0] ?? null;
    quality = "estimated";
  } else if (
    exactStart &&
    nearestAfter &&
    nearestAfter.id !== exactStart.id &&
    Math.abs(Date.parse(exactStart.captured_at) - targetStartMs) >
      Math.abs(Date.parse(nearestAfter.captured_at) - targetStartMs)
  ) {
    startSnapshot = nearestAfter;
    quality = "estimated";
  }

  if (!startSnapshot || startSnapshot.id === endSnapshot.id) {
    return {
      windowHours,
      quality: "unavailable",
      viewsPerHour: null,
      viewDelta: null,
      elapsedHours: null,
      startCapturedAt: startSnapshot?.captured_at ?? null,
      endCapturedAt: endSnapshot.captured_at,
      reason: "no_window_boundary_snapshots",
    };
  }

  const elapsedHours = hoursBetween(startSnapshot.captured_at, endSnapshot.captured_at);
  if (elapsedHours <= 0) {
    return {
      windowHours,
      quality: "unavailable",
      viewsPerHour: null,
      viewDelta: null,
      elapsedHours,
      startCapturedAt: startSnapshot.captured_at,
      endCapturedAt: endSnapshot.captured_at,
      reason: "hourly_unique_granularity",
    };
  }

  const viewDelta = endSnapshot.view_count - startSnapshot.view_count;

  return {
    windowHours,
    quality,
    viewsPerHour: viewDelta / elapsedHours,
    viewDelta,
    elapsedHours,
    startCapturedAt: startSnapshot.captured_at,
    endCapturedAt: endSnapshot.captured_at,
    reason:
      quality === "estimated"
        ? "nearest_snapshot_used"
        : undefined,
  };
}

export function analyzeVideoVelocity(
  videoId: string,
  snapshots: VideoSnapshotRow[],
  referenceEndMs: number = Date.now(),
): VelocityAnalysis {
  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );

  return {
    videoId,
    snapshotCount: sorted.length,
    firstCapturedAt: sorted[0]?.captured_at ?? null,
    lastCapturedAt: sorted.at(-1)?.captured_at ?? null,
    samples: ([1, 3, 6, 24] as const).map((windowHours) =>
      computeVelocitySample(sorted, windowHours, referenceEndMs),
    ),
  };
}

export function analyzeMixedSourceSnapshots(
  snapshots: VideoSnapshotRow[],
): {
  duplicateHourBuckets: number;
  minGapMinutes: number | null;
  maxGapHours: number | null;
} {
  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );

  const hourBuckets = new Set<string>();
  let duplicateHourBuckets = 0;
  for (const snapshot of sorted) {
    const bucket = snapshot.captured_at.slice(0, 13);
    if (hourBuckets.has(bucket)) {
      duplicateHourBuckets += 1;
    } else {
      hourBuckets.add(bucket);
    }
  }

  let minGapMinutes: number | null = null;
  let maxGapHours: number | null = null;

  for (let index = 1; index < sorted.length; index += 1) {
    const gapMinutes =
      (Date.parse(sorted[index].captured_at) -
        Date.parse(sorted[index - 1].captured_at)) /
      (60 * 1000);
    minGapMinutes =
      minGapMinutes === null ? gapMinutes : Math.min(minGapMinutes, gapMinutes);
    maxGapHours =
      maxGapHours === null
        ? gapMinutes / 60
        : Math.max(maxGapHours, gapMinutes / 60);
  }

  return { duplicateHourBuckets, minGapMinutes, maxGapHours };
}
