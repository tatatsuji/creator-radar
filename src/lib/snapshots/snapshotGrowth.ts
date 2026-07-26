import type { VideoSnapshotRow } from "@/types/database";

const MS_PER_HOUR = 60 * 60 * 1000;

export type SnapshotGrowthStatus = "measured" | "invalid";

export interface SnapshotGrowthSegment {
  status: SnapshotGrowthStatus;
  viewsGained: number | null;
  hoursElapsed: number | null;
  viewsPerHour: number | null;
  previousViewsPerHour: number | null;
  velocityChange: number | null;
  acceleration: number | null;
  baselineCapturedAt: string;
  latestCapturedAt: string;
  invalidReason?: string;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / MS_PER_HOUR;
}

function sanitizeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0 || !isFiniteNumber(numerator) || !isFiniteNumber(denominator)) {
    return null;
  }

  const value = numerator / denominator;
  return isFiniteNumber(value) ? value : null;
}

export function computeSnapshotPairGrowth(
  previous: VideoSnapshotRow,
  latest: VideoSnapshotRow,
  priorSegment?: SnapshotGrowthSegment | null,
): SnapshotGrowthSegment {
  const baselineCapturedAt = previous.captured_at;
  const latestCapturedAt = latest.captured_at;
  const hoursElapsed = hoursBetween(baselineCapturedAt, latestCapturedAt);

  if (hoursElapsed <= 0) {
    return {
      status: "invalid",
      viewsGained: null,
      hoursElapsed: null,
      viewsPerHour: null,
      previousViewsPerHour: null,
      velocityChange: null,
      acceleration: null,
      baselineCapturedAt,
      latestCapturedAt,
      invalidReason: "hoursElapsed <= 0",
    };
  }

  const viewsGained = latest.view_count - previous.view_count;

  if (viewsGained < 0) {
    return {
      status: "invalid",
      viewsGained: null,
      hoursElapsed,
      viewsPerHour: null,
      previousViewsPerHour: null,
      velocityChange: null,
      acceleration: null,
      baselineCapturedAt,
      latestCapturedAt,
      invalidReason: "viewsGained < 0",
    };
  }

  const viewsPerHour = sanitizeRate(viewsGained, hoursElapsed);
  if (viewsPerHour === null) {
    return {
      status: "invalid",
      viewsGained,
      hoursElapsed,
      viewsPerHour: null,
      previousViewsPerHour: null,
      velocityChange: null,
      acceleration: null,
      baselineCapturedAt,
      latestCapturedAt,
      invalidReason: "viewsPerHour not finite",
    };
  }

  const previousViewsPerHour =
    priorSegment?.status === "measured" ? priorSegment.viewsPerHour : null;

  const velocityChange =
    previousViewsPerHour === null
      ? null
      : sanitizeRate(viewsPerHour - previousViewsPerHour, 1);

  const acceleration =
    velocityChange === null
      ? null
      : sanitizeRate(velocityChange, hoursElapsed);

  return {
    status: "measured",
    viewsGained,
    hoursElapsed,
    viewsPerHour,
    previousViewsPerHour,
    velocityChange,
    acceleration,
    baselineCapturedAt,
    latestCapturedAt,
  };
}

export function computeLatestSnapshotGrowth(
  snapshots: VideoSnapshotRow[],
): SnapshotGrowthSegment | null {
  if (snapshots.length < 2) {
    return null;
  }

  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );

  if (sorted.length === 2) {
    return computeSnapshotPairGrowth(sorted[0], sorted[1]);
  }

  const priorSegment = computeSnapshotPairGrowth(
    sorted[sorted.length - 3],
    sorted[sorted.length - 2],
  );

  return computeSnapshotPairGrowth(
    sorted[sorted.length - 2],
    sorted[sorted.length - 1],
    priorSegment,
  );
}

export function computeSnapshotGrowthSeries(
  snapshots: VideoSnapshotRow[],
): SnapshotGrowthSegment[] {
  const sorted = [...snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );

  const segments: SnapshotGrowthSegment[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    segments.push(
      computeSnapshotPairGrowth(
        sorted[index - 1],
        sorted[index],
        segments.at(-1) ?? null,
      ),
    );
  }

  return segments;
}
