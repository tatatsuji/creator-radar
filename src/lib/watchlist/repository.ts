import { randomUUID } from "node:crypto";

import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  computeNextWatchlistCheckAt,
  determineInitialWatchTier,
} from "@/lib/watchlist/watchTier";
import { computeWatchlistFailureNextCheckAt } from "@/lib/watchlist/watchlistFailureBackoff";
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

export function isWatchlistPollingEligible(
  row: Pick<ChannelWatchlistRow, "watch_status" | "watch_tier">,
): boolean {
  if (!ACTIVE_WATCH_STATUSES.includes(row.watch_status as WatchStatus)) {
    return false;
  }
  return row.watch_tier !== "archive";
}

export function filterDueWatchlistChannels(
  rows: ChannelWatchlistRow[],
  limit: number,
  nowMs: number = Date.now(),
): ChannelWatchlistRow[] {
  return rows
    .filter((row) => isWatchlistPollingEligible(row))
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
  /** Used for initial tier when channels.subscriber_count is unavailable. */
  subscriberCount?: number | null;
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

async function lookupChannelSubscriberCount(
  channelId: string,
): Promise<number | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channels")
    .select("subscriber_count, subscriber_count_hidden")
    .eq("youtube_channel_id", channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`channels subscriber lookup failed: ${error.message}`);
  }

  if (!data || data.subscriber_count_hidden) {
    return null;
  }

  return data.subscriber_count ?? null;
}

async function resolveWatchTierForUpsert(
  input: UpsertWatchlistChannelInput,
): Promise<WatchTier> {
  if (input.watchTier) {
    return input.watchTier;
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error } = await supabase
    .from("channel_watchlist")
    .select("watch_tier")
    .eq("channel_id", input.channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`channel_watchlist lookup failed: ${error.message}`);
  }

  if (existing?.watch_tier && isWatchTier(existing.watch_tier)) {
    return existing.watch_tier;
  }

  const subscriberCount =
    input.subscriberCount !== undefined
      ? input.subscriberCount
      : await lookupChannelSubscriberCount(input.channelId);

  return determineInitialWatchTier(subscriberCount);
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
  const watchTier = await resolveWatchTierForUpsert(input);

  const { error } = await supabase.from("channel_watchlist").upsert(
    {
      channel_id: input.channelId,
      name: input.name ?? null,
      category: input.category ?? null,
      source: input.source ?? null,
      priority: input.priority ?? 0,
      notes: input.notes ?? null,
      watch_tier: watchTier,
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
    .neq("watch_tier", "archive")
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
    .in("watch_status", ACTIVE_WATCH_STATUSES)
    .neq("watch_tier", "archive");

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

export async function markWatchlistChecked(
  channelId: string,
  watchTier: WatchTier,
): Promise<void> {
  if (!isWatchTier(watchTier)) {
    throw new Error(`Invalid watch tier: ${watchTier}`);
  }

  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const now = new Date();
  const nextCheckAt = computeNextWatchlistCheckAt(watchTier, now);

  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      last_checked_at: now.toISOString(),
      next_check_at: nextCheckAt.toISOString(),
      failure_count: 0,
      updated_at: nowIso(),
    })
    .eq("channel_id", channelId);

  if (error) {
    throw new Error(`channel_watchlist checked update failed: ${error.message}`);
  }
}

export async function markWatchlistFailure(
  channelId: string,
  measuredAt: Date = new Date(),
): Promise<number> {
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
  const nextCheckAt = computeWatchlistFailureNextCheckAt(measuredAt, nextCount);
  const { error } = await supabase
    .from("channel_watchlist")
    .update({
      failure_count: nextCount,
      next_check_at: nextCheckAt.toISOString(),
      updated_at: nowIso(),
    })
    .eq("channel_id", channelId);

  if (error) {
    throw new Error(`channel_watchlist failure update failed: ${error.message}`);
  }

  return nextCount;
}

/** @deprecated Use markWatchlistFailure — kept for test mocks during migration. */
export async function incrementWatchlistFailureCount(
  channelId: string,
): Promise<void> {
  await markWatchlistFailure(channelId);
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

export async function isChannelOnWatchlist(channelId: string): Promise<boolean> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("channel_id")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`channel_watchlist lookup failed: ${error.message}`);
  }

  return Boolean(data?.channel_id);
}

export async function getWatchlistChannelById(
  channelId: string,
): Promise<ChannelWatchlistRow | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("*")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`channel_watchlist lookup failed: ${error.message}`);
  }

  return (data as ChannelWatchlistRow | null) ?? null;
}

export async function listWatchlistChannels(): Promise<ChannelWatchlistRow[]> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("*")
    .order("priority", { ascending: false })
    .order("channel_id", { ascending: true });

  if (error) {
    throw new Error(`channel_watchlist list failed: ${error.message}`);
  }

  return (data ?? []) as ChannelWatchlistRow[];
}

export async function insertWatchlistChannelIfAbsent(
  input: UpsertWatchlistChannelInput,
): Promise<"inserted" | "exists"> {
  assertSupabaseConfigured();

  if (await isChannelOnWatchlist(input.channelId)) {
    return "exists";
  }

  if (input.watchTier && !isWatchTier(input.watchTier)) {
    throw new Error(`Invalid watch tier: ${input.watchTier}`);
  }
  if (input.watchStatus && !isWatchStatus(input.watchStatus)) {
    throw new Error(`Invalid watch status: ${input.watchStatus}`);
  }

  const supabase = createSupabaseServerClient();
  const now = nowIso();
  const watchTier =
    input.watchTier ??
    determineInitialWatchTier(
      input.subscriberCount !== undefined
        ? input.subscriberCount
        : await lookupChannelSubscriberCount(input.channelId),
    );

  const { error } = await supabase.from("channel_watchlist").insert({
    channel_id: input.channelId,
    name: input.name ?? null,
    category: input.category ?? null,
    source: input.source ?? null,
    priority: input.priority ?? 0,
    notes: input.notes ?? null,
    watch_tier: watchTier,
    watch_status: input.watchStatus ?? OBSERVABILITY_CONFIG.defaults.watchStatus,
    next_check_at: input.nextCheckAt === undefined ? now : input.nextCheckAt,
    updated_at: now,
  });

  if (error) {
    if (error.code === "23505") {
      return "exists";
    }
    throw new Error(`channel_watchlist insert failed: ${error.message}`);
  }

  return "inserted";
}
