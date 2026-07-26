import { randomUUID } from "node:crypto";

import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import { computeDefaultNextCheckAt } from "@/lib/observability/scheduling";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { ChannelWatchlistRow } from "@/types/database";
import type { WatchStatus, WatchTier } from "@/types/observability";
import { isWatchStatus, isWatchTier } from "@/types/observability";

const ACTIVE_WATCH_STATUSES: WatchStatus[] = ["seed", "discovered", "active"];

export function isWatchlistLockActive(
  lockedUntil: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!lockedUntil) {
    return false;
  }
  return new Date(lockedUntil).getTime() > nowMs;
}

export function filterDueWatchlistChannels(
  rows: ChannelWatchlistRow[],
  limit: number,
  nowMs: number = Date.now(),
): ChannelWatchlistRow[] {
  return rows
    .filter((row) => ACTIVE_WATCH_STATUSES.includes(row.watch_status as WatchStatus))
    .filter((row) => {
      const isDue =
        !row.next_check_at ||
        new Date(row.next_check_at).getTime() <= nowMs;
      const isUnlocked = !isWatchlistLockActive(row.locked_until, nowMs);
      return isDue && isUnlocked;
    })
    .slice(0, limit);
}

export interface UpsertWatchlistChannelInput {
  channelId: string;
  name?: string | null;
  category?: string | null;
  source?: string | null;
  priority?: number;
  notes?: string | null;
  watchTier?: WatchTier;
  watchStatus?: WatchStatus;
  nextCheckAt?: string | null;
}

export interface WatchlistLockHandle {
  channelId: string;
  lockToken: string;
}

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertWatchlistChannel(
  input: UpsertWatchlistChannelInput,
): Promise<void> {
  assertSupabaseConfigured();

  if (input.watchTier && !isWatchTier(input.watchTier)) {
    throw new Error(`Invalid watch tier: ${input.watchTier}`);
  }
  if (input.watchStatus && !isWatchStatus(input.watchStatus)) {
    throw new Error(`Invalid watch status: ${input.watchStatus}`);
  }
  if (input.priority !== undefined && input.priority < 0) {
    throw new Error("priority must be >= 0");
  }

  const supabase = createSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase.from("channel_watchlist").upsert(
    {
      channel_id: input.channelId,
      name: input.name ?? null,
      category: input.category ?? null,
      source: input.source ?? null,
      priority: input.priority ?? 0,
      notes: input.notes ?? null,
      watch_tier: input.watchTier ?? OBSERVABILITY_CONFIG.defaults.watchTier,
      watch_status:
        input.watchStatus ?? OBSERVABILITY_CONFIG.defaults.watchStatus,
      next_check_at:
        input.nextCheckAt === undefined
          ? now
          : input.nextCheckAt,
      updated_at: now,
    },
    { onConflict: "channel_id" },
  );

  if (error) {
    throw new Error(`channel_watchlist upsert failed: ${error.message}`);
  }
}

export async function getDueWatchlistChannels(
  limit: number = OBSERVABILITY_CONFIG.repositoryLimits.maxDueChannels,
): Promise<ChannelWatchlistRow[]> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("*")
    .in("watch_status", ACTIVE_WATCH_STATUSES)
    .order("priority", { ascending: false })
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(`channel_watchlist due lookup failed: ${error.message}`);
  }

  return filterDueWatchlistChannels(
    (data ?? []) as ChannelWatchlistRow[],
    limit,
    nowMs,
  );
}

export async function countWatchlistChannels(): Promise<number> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("channel_watchlist")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`channel_watchlist count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function countDueWatchlistChannels(): Promise<number> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const nowMs = Date.now();

  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("*")
    .in("watch_status", ACTIVE_WATCH_STATUSES);

  if (error) {
    throw new Error(`channel_watchlist due count failed: ${error.message}`);
  }

  return filterDueWatchlistChannels(
    (data ?? []) as ChannelWatchlistRow[],
    Number.MAX_SAFE_INTEGER,
    nowMs,
  ).length;
}

export async function updateWatchlistNextCheckAt(
  channelId: string,
  nextCheckAt: Date,
): Promise<void> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      next_check_at: nextCheckAt.toISOString(),
      updated_at: nowIso(),
    })
    .eq("channel_id", channelId);

  if (error) {
    throw new Error(`channel_watchlist next_check_at update failed: ${error.message}`);
  }
}

export async function markWatchlistChecked(channelId: string): Promise<void> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const now = nowIso();
  const nextCheckAt = computeDefaultNextCheckAt(new Date());

  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      last_checked_at: now,
      next_check_at: nextCheckAt.toISOString(),
      failure_count: 0,
      updated_at: now,
    })
    .eq("channel_id", channelId);

  if (error) {
    throw new Error(`channel_watchlist checked update failed: ${error.message}`);
  }
}

export async function incrementWatchlistFailureCount(
  channelId: string,
): Promise<void> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error: selectError } = await supabase
    .from("channel_watchlist")
    .select("failure_count")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (selectError) {
    throw new Error(
      `channel_watchlist failure lookup failed: ${selectError.message}`,
    );
  }

  const nextCount = (data?.failure_count ?? 0) + 1;
  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      failure_count: nextCount,
      updated_at: nowIso(),
    })
    .eq("channel_id", channelId);

  if (error) {
    throw new Error(`channel_watchlist failure update failed: ${error.message}`);
  }
}

export async function acquireWatchlistLock(
  channelId: string,
): Promise<WatchlistLockHandle | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const now = new Date();
  const nowIsoString = now.toISOString();

  const { data: existing, error: readError } = await supabase
    .from("channel_watchlist")
    .select("locked_until")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (readError) {
    throw new Error(`channel_watchlist lock read failed: ${readError.message}`);
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
    .from("channel_watchlist")
    .update({
      lock_token: lockToken,
      locked_until: lockedUntil,
      updated_at: nowIsoString,
    })
    .eq("channel_id", channelId)
    .select("channel_id, lock_token")
    .maybeSingle();

  if (error) {
    throw new Error(`channel_watchlist lock acquire failed: ${error.message}`);
  }

  if (!data || data.lock_token !== lockToken) {
    return null;
  }

  return { channelId, lockToken };
}

export async function releaseWatchlistLock(
  handle: WatchlistLockHandle,
): Promise<void> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      lock_token: null,
      locked_until: null,
      updated_at: nowIso(),
    })
    .eq("channel_id", handle.channelId)
    .eq("lock_token", handle.lockToken);

  if (error) {
    throw new Error(`channel_watchlist lock release failed: ${error.message}`);
  }
}

export async function updateWatchlistTierAndStatus(
  channelId: string,
  watchTier: WatchTier,
  watchStatus: WatchStatus,
): Promise<void> {
  if (!isWatchTier(watchTier)) {
    throw new Error(`Invalid watch tier: ${watchTier}`);
  }
  if (!isWatchStatus(watchStatus)) {
    throw new Error(`Invalid watch status: ${watchStatus}`);
  }

  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      watch_tier: watchTier,
      watch_status: watchStatus,
      updated_at: nowIso(),
    })
    .eq("channel_id", channelId);

  if (error) {
    throw new Error(`channel_watchlist tier/status update failed: ${error.message}`);
  }
}
