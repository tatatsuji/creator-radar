import { computeLatestSnapshotGrowth } from "@/lib/snapshots/snapshotGrowth";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { computePromotionMetrics } from "@/lib/promotion/metrics";
import {
  evaluateAdaptiveMeasurementTier,
  evaluateInitialAdaptiveMeasurementTier,
  type AdaptiveMeasurementSignals,
  type AdaptiveMeasurementTierDecision,
} from "@/lib/measurement/adaptiveMeasurementTierEvaluation";
import {
  ADAPTIVE_MEASUREMENT_CONFIG,
  normalizeAdaptiveMeasurementTier,
  type AdaptiveMeasurementTier,
} from "@/lib/measurement/adaptiveMeasurementConfig";
import { fetchSnapshotsForVideo } from "@/lib/snapshots/repository";
import type { VideoSnapshotRow } from "@/types/database";
import type { WatchTier } from "@/types/observability";
import { isWatchTier } from "@/types/observability";

const RANKING_DISCOVERY_SOURCE_TYPES = new Set([
  "search",
  "category_search",
  "most_popular",
  "short_form_candidate",
  "live_search",
  "shorts_search",
]);

function hoursBetween(startIso: string | null, endMs: number): number | null {
  if (!startIso) {
    return null;
  }

  const elapsedMs = endMs - new Date(startIso).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) {
    return null;
  }

  return elapsedMs / (60 * 60 * 1000);
}

export function computeStaleWindowMetrics(input: {
  snapshots: VideoSnapshotRow[];
  currentViewCount: number;
  measuredAtMs: number;
  staleHours?: number;
}): {
  viewsGainedInStaleWindow: number | null;
  staleWindowHours: number | null;
} {
  const staleHours = input.staleHours ?? ADAPTIVE_MEASUREMENT_CONFIG.staleHours;

  if (input.snapshots.length === 0) {
    return { viewsGainedInStaleWindow: null, staleWindowHours: null };
  }

  const sorted = [...input.snapshots].sort(
    (left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at),
  );
  const windowStartMs = input.measuredAtMs - staleHours * 60 * 60 * 1000;

  let baselineSnapshot: VideoSnapshotRow | null = null;
  for (const snapshot of sorted) {
    if (Date.parse(snapshot.captured_at) <= windowStartMs) {
      baselineSnapshot = snapshot;
    } else {
      break;
    }
  }

  if (!baselineSnapshot) {
    baselineSnapshot = sorted[0] ?? null;
  }

  if (!baselineSnapshot) {
    return { viewsGainedInStaleWindow: null, staleWindowHours: null };
  }

  const staleWindowHours =
    (input.measuredAtMs - Date.parse(baselineSnapshot.captured_at)) /
    (60 * 60 * 1000);

  if (staleWindowHours < staleHours) {
    return { viewsGainedInStaleWindow: null, staleWindowHours };
  }

  const viewsGainedInStaleWindow =
    input.currentViewCount - baselineSnapshot.view_count;

  if (viewsGainedInStaleWindow < 0) {
    return { viewsGainedInStaleWindow: null, staleWindowHours };
  }

  return { viewsGainedInStaleWindow, staleWindowHours };
}

export function buildAdaptiveMeasurementSignals(input: {
  publishedAt: string | null;
  lastMeasuredAt: string | null;
  currentViewCount: number;
  snapshots: Awaited<ReturnType<typeof fetchSnapshotsForVideo>>;
  watchlistTier: WatchTier | null;
  hasRankingDiscovery: boolean;
  measuredAtMs?: number;
}): AdaptiveMeasurementSignals {
  const measuredAtMs = input.measuredAtMs ?? Date.now();
  const metrics = computePromotionMetrics({
    videoId: "signal-build",
    snapshots: input.snapshots,
    currentViewCount: input.currentViewCount,
    subscriberCount: null,
    firstDiscoveredAt: null,
    referenceEndMs: measuredAtMs,
  });

  const latestGrowth = computeLatestSnapshotGrowth(input.snapshots);
  const staleWindow = computeStaleWindowMetrics({
    snapshots: input.snapshots,
    currentViewCount: input.currentViewCount,
    measuredAtMs,
  });

  return {
    hoursSincePublish: hoursBetween(input.publishedAt, measuredAtMs),
    v1h: metrics.v1h,
    velocityChangeRate: metrics.velocityChangeRate,
    viewsGainedSinceLastMeasure:
      latestGrowth?.status === "measured" ? latestGrowth.viewsGained : null,
    hoursSinceLastMeasure: hoursBetween(input.lastMeasuredAt, measuredAtMs),
    viewsGainedInStaleWindow: staleWindow.viewsGainedInStaleWindow,
    staleWindowHours: staleWindow.staleWindowHours,
    watchlistTier: input.watchlistTier,
    hasRankingDiscovery: input.hasRankingDiscovery,
    snapshotCount: input.snapshots.length,
  };
}

async function loadVideoPublishedAt(videoId: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("videos")
    .select("published_at")
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (error) {
    throw new Error(`videos published_at lookup failed: ${error.message}`);
  }

  return data?.published_at ?? null;
}

async function loadChannelWatchlistTier(
  channelId: string | null,
): Promise<WatchTier | null> {
  if (!channelId) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channel_watchlist")
    .select("watch_tier")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`channel_watchlist tier lookup failed: ${error.message}`);
  }

  if (data?.watch_tier && isWatchTier(data.watch_tier)) {
    return data.watch_tier;
  }

  return null;
}

async function loadHasRankingDiscovery(
  videoId: string,
): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("candidate_discoveries")
    .select("source_type")
    .eq("video_id", videoId);

  if (error) {
    throw new Error(`candidate_discoveries lookup failed: ${error.message}`);
  }

  return (data ?? []).some((row) =>
    RANKING_DISCOVERY_SOURCE_TYPES.has(row.source_type),
  );
}

async function loadVideoChannelId(videoId: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("videos")
    .select("channel_id")
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (error) {
    throw new Error(`videos channel lookup failed: ${error.message}`);
  }

  return data?.channel_id ?? null;
}

export async function loadAdaptiveMeasurementSignals(
  videoId: string,
  currentViewCount: number,
  lastMeasuredAt: string | null,
  measuredAt: Date = new Date(),
): Promise<AdaptiveMeasurementSignals> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const [publishedAt, snapshots, channelId, hasRankingDiscovery] =
    await Promise.all([
      loadVideoPublishedAt(videoId),
      fetchSnapshotsForVideo(videoId),
      loadVideoChannelId(videoId),
      loadHasRankingDiscovery(videoId),
    ]);
  const watchlistTier = await loadChannelWatchlistTier(channelId);

  return buildAdaptiveMeasurementSignals({
    publishedAt,
    lastMeasuredAt,
    currentViewCount,
    snapshots,
    watchlistTier,
    hasRankingDiscovery,
    measuredAtMs: measuredAt.getTime(),
  });
}

export async function resolveInitialAdaptiveMeasurementTier(
  videoId: string,
): Promise<AdaptiveMeasurementTierDecision> {
  const [publishedAt, channelId, hasRankingDiscovery] = await Promise.all([
    loadVideoPublishedAt(videoId),
    loadVideoChannelId(videoId),
    loadHasRankingDiscovery(videoId),
  ]);
  const watchlistTier = await loadChannelWatchlistTier(channelId);
  const hoursSincePublish = hoursBetween(publishedAt, Date.now());

  return evaluateInitialAdaptiveMeasurementTier({
    hoursSincePublish,
    watchlistTier,
    hasRankingDiscovery,
  });
}

export async function resolveAdaptiveMeasurementTier(
  videoId: string,
  currentTier: string,
  currentViewCount: number,
  lastMeasuredAt: string | null,
  measuredAt: Date = new Date(),
): Promise<AdaptiveMeasurementTierDecision & { normalizedPreviousTier: AdaptiveMeasurementTier }> {
  const signals = await loadAdaptiveMeasurementSignals(
    videoId,
    currentViewCount,
    lastMeasuredAt,
    measuredAt,
  );
  const decision = evaluateAdaptiveMeasurementTier(signals);

  return {
    ...decision,
    normalizedPreviousTier: normalizeAdaptiveMeasurementTier(currentTier),
  };
}

export type { AdaptiveMeasurementSignals };
