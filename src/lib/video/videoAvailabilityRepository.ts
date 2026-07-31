import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { VideoAvailabilityStatus } from "@/types/observability";
import { isVideoAvailabilityStatus } from "@/types/observability";

import type { VideoAvailabilityState } from "./videoAvailability";

export interface VideoAvailabilityRow {
  videoId: string;
  state: VideoAvailabilityState;
}

const DEFAULT_AVAILABILITY_STATE: VideoAvailabilityState = {
  availabilityStatus: "active",
  unavailableCount: 0,
  firstUnavailableAt: null,
  lastUnavailableAt: null,
};

let availabilityColumnsAvailable: boolean | null = null;
let availabilityMigrationWarningLogged = false;

function warnAvailabilityTrackingDisabledOnce(): void {
  if (availabilityMigrationWarningLogged) {
    return;
  }

  availabilityMigrationWarningLogged = true;
  console.warn(
    "[CreatorRadar] Video availability tracking is disabled because migration 009_video_availability.sql is not applied. Existing measurement continues unchanged.",
  );
}

function markAvailabilityColumnsMissing(): void {
  availabilityColumnsAvailable = false;
  warnAvailabilityTrackingDisabledOnce();
}

function isMissingAvailabilityColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42703" ||
    error.message?.includes("availability_status") === true ||
    error.message?.includes("unavailable_count") === true ||
    error.message?.includes("last_available_at") === true ||
    error.message?.includes("first_unavailable_at") === true ||
    error.message?.includes("last_unavailable_at") === true
  );
}

function parseAvailabilityRow(row: {
  youtube_video_id: string;
  availability_status?: string | null;
  unavailable_count?: number | null;
  first_unavailable_at?: string | null;
  last_unavailable_at?: string | null;
}): VideoAvailabilityRow {
  const status = row.availability_status;
  const availabilityStatus: VideoAvailabilityStatus =
    status && isVideoAvailabilityStatus(status) ? status : "active";

  return {
    videoId: row.youtube_video_id,
    state: {
      availabilityStatus,
      unavailableCount: row.unavailable_count ?? 0,
      firstUnavailableAt: row.first_unavailable_at ?? null,
      lastUnavailableAt: row.last_unavailable_at ?? null,
    },
  };
}

export async function isVideoAvailabilityTrackingEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  if (availabilityColumnsAvailable !== null) {
    return availabilityColumnsAvailable;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("videos")
    .select("availability_status")
    .limit(1);

  if (error && isMissingAvailabilityColumnError(error)) {
    markAvailabilityColumnsMissing();
    return false;
  }

  if (error) {
    throw new Error(`videos availability probe failed: ${error.message}`);
  }

  availabilityColumnsAvailable = true;
  return true;
}

export async function fetchVideoAvailabilityStates(
  videoIds: readonly string[],
): Promise<Map<string, VideoAvailabilityState>> {
  const states = new Map<string, VideoAvailabilityState>();

  for (const videoId of videoIds) {
    states.set(videoId, { ...DEFAULT_AVAILABILITY_STATE });
  }

  if (videoIds.length === 0 || !(await isVideoAvailabilityTrackingEnabled())) {
    return states;
  }

  const supabase = createSupabaseServerClient();

  for (let index = 0; index < videoIds.length; index += 100) {
    const batch = videoIds.slice(index, index + 100);
    const { data, error } = await supabase
      .from("videos")
      .select(
        "youtube_video_id, availability_status, unavailable_count, first_unavailable_at, last_unavailable_at",
      )
      .in("youtube_video_id", batch);

    if (error) {
      if (isMissingAvailabilityColumnError(error)) {
        markAvailabilityColumnsMissing();
        return states;
      }
      throw new Error(`videos availability lookup failed: ${error.message}`);
    }

    for (const row of data ?? []) {
      const parsed = parseAvailabilityRow(
        row as {
          youtube_video_id: string;
          availability_status?: string | null;
          unavailable_count?: number | null;
          first_unavailable_at?: string | null;
          last_unavailable_at?: string | null;
        },
      );
      states.set(parsed.videoId, parsed.state);
    }
  }

  return states;
}

export async function listDeletedOrPrivateVideoIds(
  videoIds: readonly string[],
): Promise<Set<string>> {
  const deleted = new Set<string>();

  if (videoIds.length === 0 || !(await isVideoAvailabilityTrackingEnabled())) {
    return deleted;
  }

  const supabase = createSupabaseServerClient();

  for (let index = 0; index < videoIds.length; index += 100) {
    const batch = videoIds.slice(index, index + 100);
    const { data, error } = await supabase
      .from("videos")
      .select("youtube_video_id, availability_status")
      .in("youtube_video_id", batch)
      .eq("availability_status", "deleted_or_private");

    if (error) {
      if (isMissingAvailabilityColumnError(error)) {
        markAvailabilityColumnsMissing();
        return deleted;
      }
      throw new Error(
        `videos deleted_or_private lookup failed: ${error.message}`,
      );
    }

    for (const row of data ?? []) {
      deleted.add(row.youtube_video_id as string);
    }
  }

  return deleted;
}

export async function persistVideoAvailabilityActive(
  videoId: string,
  nowIso: string,
): Promise<void> {
  if (!(await isVideoAvailabilityTrackingEnabled())) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("videos")
    .update({
      availability_status: "active",
      unavailable_count: 0,
      last_available_at: nowIso,
      first_unavailable_at: null,
      last_unavailable_at: null,
      updated_at: nowIso,
    })
    .eq("youtube_video_id", videoId);

  if (error && !isMissingAvailabilityColumnError(error)) {
    throw new Error(`videos availability active update failed: ${error.message}`);
  }
}

export async function persistVideoAvailabilityMissing(
  videoId: string,
  nextState: VideoAvailabilityState,
  nowIso: string,
): Promise<void> {
  if (!(await isVideoAvailabilityTrackingEnabled())) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("videos")
    .update({
      availability_status: nextState.availabilityStatus,
      unavailable_count: nextState.unavailableCount,
      first_unavailable_at: nextState.firstUnavailableAt,
      last_unavailable_at: nextState.lastUnavailableAt,
      updated_at: nowIso,
    })
    .eq("youtube_video_id", videoId);

  if (error && !isMissingAvailabilityColumnError(error)) {
    throw new Error(
      `videos availability missing update failed: ${error.message}`,
    );
  }
}

/** Resets probe cache — for tests only. */
export function resetVideoAvailabilityTrackingProbeForTests(): void {
  availabilityColumnsAvailable = null;
  availabilityMigrationWarningLogged = false;
}

export function wasAvailabilityMigrationWarningLogged(): boolean {
  return availabilityMigrationWarningLogged;
}
