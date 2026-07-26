import { randomUUID } from "node:crypto";

import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  computeFailureBackoffNextAt,
  computeNextMeasurementAtAfterSuccess,
  shouldMarkMeasurementFailed,
} from "@/lib/observability/measurementScheduling";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { MeasurementScheduleRow } from "@/types/database";
import type { MeasurementStatus, MeasurementTier } from "@/types/observability";
import {
  isMeasurementStatus,
  isMeasurementTier,
} from "@/types/observability";

const DUE_STATUSES: MeasurementStatus[] = ["pending", "active"];

export interface MeasurementLockHandle {
  videoId: string;
  lockToken: string;
}

export interface UpsertScheduleResult {
  videoId: string;
  status: "created" | "exists";
}

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export function isMeasurementLockActive(
  lockedUntil: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!lockedUntil) {
    return false;
  }
  return new Date(lockedUntil).getTime() > nowMs;
}

export function filterDueMeasurementSchedules(
  rows: MeasurementScheduleRow[],
  limit: number,
  nowMs: number = Date.now(),
): MeasurementScheduleRow[] {
  return rows
    .filter((row) =>
      DUE_STATUSES.includes(row.measurement_status as MeasurementStatus),
    )
    .filter((row) => {
      const isDue =
        !row.next_measurement_at ||
        new Date(row.next_measurement_at).getTime() <= nowMs;
      const isUnlocked = !isMeasurementLockActive(row.locked_until, nowMs);
      return isDue && isUnlocked;
    })
    .slice(0, limit);
}

export async function upsertSchedule(videoId: string): Promise<UpsertScheduleResult> {
  assertSupabaseConfigured();

  if (!videoId.trim()) {
    throw new Error("videoId must not be empty");
  }

  const supabase = createSupabaseServerClient();
  const now = nowIso();

  const { data: existing, error: readError } = await supabase
    .from("measurement_schedule")
    .select("video_id")
    .eq("video_id", videoId)
    .maybeSingle();

  if (readError) {
    throw new Error(`measurement_schedule lookup failed: ${readError.message}`);
  }

  if (existing) {
    return { videoId, status: "exists" };
  }

  const { error } = await supabase.from("measurement_schedule").insert({
    video_id: videoId,
    measurement_tier: "hot",
    measurement_status: "pending",
    next_measurement_at: now,
    failure_count: 0,
    updated_at: now,
  });

  if (error) {
    throw new Error(`measurement_schedule insert failed: ${error.message}`);
  }

  return { videoId, status: "created" };
}

export async function upsertSchedulesBatch(
  videoIds: string[],
): Promise<{ created: number; exists: number; failed: number }> {
  let created = 0;
  let exists = 0;
  let failed = 0;

  for (const videoId of videoIds) {
    try {
      const result = await upsertSchedule(videoId);
      if (result.status === "created") {
        created += 1;
      } else {
        exists += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { created, exists, failed };
}

export async function getDueVideos(
  limit: number = OBSERVABILITY_CONFIG.batchSize.measurement,
): Promise<MeasurementScheduleRow[]> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("measurement_schedule")
    .select("*")
    .in("measurement_status", DUE_STATUSES)
    .order("next_measurement_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(`measurement_schedule due lookup failed: ${error.message}`);
  }

  return filterDueMeasurementSchedules(
    (data ?? []) as MeasurementScheduleRow[],
    limit,
    nowMs,
  );
}

export async function acquireMeasurementLock(
  videoId: string,
): Promise<MeasurementLockHandle | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const now = new Date();
  const nowIsoString = now.toISOString();

  const { data: existing, error: readError } = await supabase
    .from("measurement_schedule")
    .select("locked_until")
    .eq("video_id", videoId)
    .maybeSingle();

  if (readError) {
    throw new Error(`measurement_schedule lock read failed: ${readError.message}`);
  }

  if (
    existing?.locked_until &&
    new Date(existing.locked_until).getTime() > now.getTime()
  ) {
    return null;
  }

  const lockToken = randomUUID();
  const lockedUntil = new Date(
    now.getTime() + OBSERVABILITY_CONFIG.lockTtlMs,
  ).toISOString();

  const { data, error } = await supabase
    .from("measurement_schedule")
    .update({
      lock_token: lockToken,
      locked_until: lockedUntil,
      updated_at: nowIsoString,
    })
    .eq("video_id", videoId)
    .select("video_id, lock_token")
    .maybeSingle();

  if (error) {
    throw new Error(`measurement_schedule lock acquire failed: ${error.message}`);
  }

  if (!data || data.lock_token !== lockToken) {
    return null;
  }

  return { videoId, lockToken };
}

export async function acquireMeasurementLocks(
  videoIds: string[],
): Promise<{ locked: MeasurementLockHandle[]; skipped: string[] }> {
  const locked: MeasurementLockHandle[] = [];
  const skipped: string[] = [];

  for (const videoId of videoIds) {
    const handle = await acquireMeasurementLock(videoId);
    if (handle) {
      locked.push(handle);
    } else {
      skipped.push(videoId);
    }
  }

  return { locked, skipped };
}

export async function releaseMeasurementLock(
  handle: MeasurementLockHandle,
): Promise<void> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("measurement_schedule")
    .update({
      lock_token: null,
      locked_until: null,
      updated_at: nowIso(),
    })
    .eq("video_id", handle.videoId)
    .eq("lock_token", handle.lockToken);

  if (error) {
    throw new Error(`measurement_schedule lock release failed: ${error.message}`);
  }
}

export async function markMeasurementSuccess(
  videoId: string,
  tier: MeasurementTier,
  measuredAt: Date,
): Promise<void> {
  if (!isMeasurementTier(tier)) {
    throw new Error(`Invalid measurement tier: ${tier}`);
  }

  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const nextMeasurementAt = computeNextMeasurementAtAfterSuccess(tier, measuredAt);

  const { error } = await supabase
    .from("measurement_schedule")
    .update({
      measurement_status: "active",
      last_measured_at: measuredAt.toISOString(),
      next_measurement_at: nextMeasurementAt.toISOString(),
      failure_count: 0,
      lock_token: null,
      locked_until: null,
      updated_at: nowIso(),
    })
    .eq("video_id", videoId);

  if (error) {
    throw new Error(`measurement_schedule success update failed: ${error.message}`);
  }
}

export async function markMeasurementFailure(
  videoId: string,
  options: {
    failureCount: number;
    reason: "not_found" | "api_error";
    measuredAt?: Date;
  },
): Promise<void> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const baseTime = options.measuredAt ?? new Date();
  const nextFailureCount = options.failureCount;
  const nextMeasurementAt = computeFailureBackoffNextAt(baseTime, nextFailureCount);
  const nextStatus: MeasurementStatus = shouldMarkMeasurementFailed(nextFailureCount)
    ? "failed"
    : "pending";

  const { error } = await supabase
    .from("measurement_schedule")
    .update({
      measurement_status: nextStatus,
      failure_count: nextFailureCount,
      next_measurement_at: nextMeasurementAt.toISOString(),
      lock_token: null,
      locked_until: null,
      updated_at: nowIso(),
    })
    .eq("video_id", videoId);

  if (error) {
    throw new Error(`measurement_schedule failure update failed: ${error.message}`);
  }
}

export async function incrementFailureCount(videoId: string): Promise<number> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error: readError } = await supabase
    .from("measurement_schedule")
    .select("failure_count")
    .eq("video_id", videoId)
    .maybeSingle();

  if (readError) {
    throw new Error(`measurement_schedule failure lookup failed: ${readError.message}`);
  }

  return (data?.failure_count ?? 0) + 1;
}

export async function updateTier(
  videoId: string,
  tier: MeasurementTier,
): Promise<void> {
  if (!isMeasurementTier(tier)) {
    throw new Error(`Invalid measurement tier: ${tier}`);
  }

  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("measurement_schedule")
    .update({
      measurement_tier: tier,
      updated_at: nowIso(),
    })
    .eq("video_id", videoId);

  if (error) {
    throw new Error(`measurement_schedule tier update failed: ${error.message}`);
  }
}

export async function updateStatus(
  videoId: string,
  status: MeasurementStatus,
): Promise<void> {
  if (!isMeasurementStatus(status)) {
    throw new Error(`Invalid measurement status: ${status}`);
  }

  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("measurement_schedule")
    .update({
      measurement_status: status,
      updated_at: nowIso(),
    })
    .eq("video_id", videoId);

  if (error) {
    throw new Error(`measurement_schedule status update failed: ${error.message}`);
  }
}

export async function markSchedulesDueForDevRemeasure(
  limit: number = OBSERVABILITY_CONFIG.repositoryLimits.maxDueVideos,
): Promise<{ updated: number; videoIds: string[] }> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const now = nowIso();
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("measurement_schedule")
    .select("video_id, next_measurement_at, locked_until, measurement_status")
    .in("measurement_status", DUE_STATUSES)
    .order("next_measurement_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(`measurement_schedule dev remeasure lookup failed: ${error.message}`);
  }

  const videoIds = (data ?? [])
    .filter((row) => {
      const isFuture =
        row.next_measurement_at &&
        new Date(row.next_measurement_at).getTime() > nowMs;
      const isLocked = isMeasurementLockActive(row.locked_until, nowMs);
      return isFuture || isLocked;
    })
    .slice(0, limit)
    .map((row) => row.video_id);

  if (videoIds.length === 0) {
    return { updated: 0, videoIds: [] };
  }

  const { error: updateError } = await supabase
    .from("measurement_schedule")
    .update({
      next_measurement_at: now,
      lock_token: null,
      locked_until: null,
      updated_at: now,
    })
    .in("video_id", videoIds);

  if (updateError) {
    throw new Error(`measurement_schedule dev remeasure update failed: ${updateError.message}`);
  }

  return { updated: videoIds.length, videoIds };
}

export async function countMeasurementSchedules(): Promise<number> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("measurement_schedule")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`measurement_schedule count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function getMeasurementScheduleSummary(): Promise<{
  total: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  dueNow: number;
  activeLocks: number;
  latestLastMeasuredAt: string | null;
}> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("measurement_schedule")
    .select(
      "measurement_tier, measurement_status, next_measurement_at, lock_token, locked_until, last_measured_at",
    );

  if (error) {
    throw new Error(`measurement_schedule summary failed: ${error.message}`);
  }

  const rows = data ?? [];
  const byTier: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let dueNow = 0;
  let activeLocks = 0;
  let latestLastMeasuredAt: string | null = null;

  for (const row of rows) {
    byTier[row.measurement_tier] = (byTier[row.measurement_tier] ?? 0) + 1;
    byStatus[row.measurement_status] = (byStatus[row.measurement_status] ?? 0) + 1;

    const isDue =
      DUE_STATUSES.includes(row.measurement_status as MeasurementStatus) &&
      (!row.next_measurement_at ||
        new Date(row.next_measurement_at).getTime() <= nowMs);
    if (isDue) {
      dueNow += 1;
    }

    if (
      row.lock_token &&
      row.locked_until &&
      new Date(row.locked_until).getTime() > nowMs
    ) {
      activeLocks += 1;
    }

    if (
      row.last_measured_at &&
      (!latestLastMeasuredAt || row.last_measured_at > latestLastMeasuredAt)
    ) {
      latestLastMeasuredAt = row.last_measured_at;
    }
  }

  return {
    total: rows.length,
    byTier,
    byStatus,
    dueNow,
    activeLocks,
    latestLastMeasuredAt,
  };
}

export async function listUnscheduledCandidateVideoIds(): Promise<string[]> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data: discoveries, error: discoveryError } = await supabase
    .from("candidate_discoveries")
    .select("video_id");

  if (discoveryError) {
    throw new Error(`candidate_discoveries lookup failed: ${discoveryError.message}`);
  }

  const uniqueVideoIds = [...new Set((discoveries ?? []).map((row) => row.video_id))];
  if (uniqueVideoIds.length === 0) {
    return [];
  }

  const { data: schedules, error: scheduleError } = await supabase
    .from("measurement_schedule")
    .select("video_id")
    .in("video_id", uniqueVideoIds);

  if (scheduleError) {
    throw new Error(`measurement_schedule lookup failed: ${scheduleError.message}`);
  }

  const scheduled = new Set((schedules ?? []).map((row) => row.video_id));
  return uniqueVideoIds.filter((videoId) => !scheduled.has(videoId));
}

export async function countFailedMeasurementSchedules(): Promise<number> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("measurement_schedule")
    .select("*", { count: "exact", head: true })
    .eq("measurement_status", "failed");

  if (error) {
    throw new Error(`measurement_schedule failed count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function listScheduledVideoIds(): Promise<string[]> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("measurement_schedule")
    .select("video_id");

  if (error) {
    throw new Error(`measurement_schedule list failed: ${error.message}`);
  }

  return (data ?? []).map((row) => row.video_id);
}
