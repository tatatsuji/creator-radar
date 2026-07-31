import { VIDEO_AVAILABILITY_CONFIG } from "@/lib/video/availabilityConfig";
import type { VideoAvailabilityStatus } from "@/types/observability";

export interface VideoAvailabilityState {
  availabilityStatus: VideoAvailabilityStatus;
  unavailableCount: number;
  firstUnavailableAt: string | null;
  lastUnavailableAt: string | null;
}

export interface VideoAvailabilityTransition {
  next: VideoAvailabilityState;
  movedToPending: boolean;
  movedToDeletedOrPrivate: boolean;
  recoveredToActive: boolean;
}

export interface VideoAvailabilityBatchSummary {
  requestedCount: number;
  returnedCount: number;
  missingCount: number;
  movedToPending: number;
  movedToDeletedOrPrivate: number;
  recoveredToActive: number;
  apiErrorCount: number;
}

export function createEmptyAvailabilityBatchSummary(
  requestedCount = 0,
): VideoAvailabilityBatchSummary {
  return {
    requestedCount,
    returnedCount: 0,
    missingCount: 0,
    movedToPending: 0,
    movedToDeletedOrPrivate: 0,
    recoveredToActive: 0,
    apiErrorCount: 0,
  };
}

export function computeMissingVideoIds(
  requestedIds: readonly string[],
  returnedIds: readonly string[],
): string[] {
  const returned = new Set(returnedIds);
  return requestedIds.filter((videoId) => !returned.has(videoId));
}

export function buildActiveAvailabilityState(
  nowIso: string,
): VideoAvailabilityState {
  return {
    availabilityStatus: "active",
    unavailableCount: 0,
    firstUnavailableAt: null,
    lastUnavailableAt: null,
  };
}

export function applyAvailabilityOnFound(
  current: VideoAvailabilityState,
  nowIso: string,
): VideoAvailabilityTransition {
  const recoveredToActive =
    current.availabilityStatus !== "active" || current.unavailableCount > 0;

  return {
    next: {
      availabilityStatus: "active",
      unavailableCount: 0,
      firstUnavailableAt: null,
      lastUnavailableAt: null,
    },
    movedToPending: false,
    movedToDeletedOrPrivate: false,
    recoveredToActive,
  };
}

export function applyAvailabilityOnMissing(
  current: VideoAvailabilityState,
  nowIso: string,
  nowMs: number = Date.parse(nowIso),
  config: typeof VIDEO_AVAILABILITY_CONFIG = VIDEO_AVAILABILITY_CONFIG,
): VideoAvailabilityTransition {
  if (current.availabilityStatus === "deleted_or_private") {
    return {
      next: current,
      movedToPending: false,
      movedToDeletedOrPrivate: false,
      recoveredToActive: false,
    };
  }

  const nextUnavailableCount = current.unavailableCount + 1;
  const firstUnavailableAt = current.firstUnavailableAt ?? nowIso;
  const elapsedMs = nowMs - Date.parse(firstUnavailableAt);
  const shouldConfirm =
    nextUnavailableCount >= config.confirmMissingCount &&
    elapsedMs >= config.confirmMinElapsedMs;

  if (shouldConfirm) {
    return {
      next: {
        availabilityStatus: "deleted_or_private",
        unavailableCount: nextUnavailableCount,
        firstUnavailableAt,
        lastUnavailableAt: nowIso,
      },
      movedToPending: false,
      movedToDeletedOrPrivate: true,
      recoveredToActive: false,
    };
  }

  const movedToPending = current.availabilityStatus === "active";

  return {
    next: {
      availabilityStatus: "unavailable_pending",
      unavailableCount: nextUnavailableCount,
      firstUnavailableAt,
      lastUnavailableAt: nowIso,
    },
    movedToPending,
    movedToDeletedOrPrivate: false,
    recoveredToActive: false,
  };
}
