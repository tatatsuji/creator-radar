import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { CandidateDiscoveryRow } from "@/types/database";
import type { DiscoverySourceType } from "@/types/observability";
import { isDiscoverySourceType } from "@/types/observability";

import {
  aggregateChannelDiscoveryMetrics,
  type ChannelAutoWatchlistMetrics,
  type ChannelDiscoveryRecord,
} from "@/lib/watchlist/autoWatchlist/autoWatchlistMetrics";

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

function toDiscoveryRecord(row: CandidateDiscoveryRow): ChannelDiscoveryRecord {
  const sourceType: DiscoverySourceType = isDiscoverySourceType(row.source_type)
    ? row.source_type
    : "manual";

  return {
    channelId: row.channel_id ?? "",
    sourceType,
    videoId: row.video_id,
    discoveredAt: row.discovered_at,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

export async function loadChannelDiscoveryRecords(
  channelIds: string[],
  sinceIso: string,
): Promise<Map<string, ChannelDiscoveryRecord[]>> {
  assertSupabaseConfigured();

  const grouped = new Map<string, ChannelDiscoveryRecord[]>();
  if (channelIds.length === 0) {
    return grouped;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("candidate_discoveries")
    .select("channel_id, source_type, video_id, discovered_at, metadata")
    .in("channel_id", channelIds)
    .gte("discovered_at", sinceIso);

  if (error) {
    throw new Error(`candidate_discoveries metrics lookup failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (!row.channel_id) {
      continue;
    }

    const records = grouped.get(row.channel_id) ?? [];
    records.push(
      toDiscoveryRecord(row as CandidateDiscoveryRow),
    );
    grouped.set(row.channel_id, records);
  }

  return grouped;
}

export async function loadChannelLastUploadAtMap(
  channelIds: string[],
): Promise<Map<string, string | null>> {
  assertSupabaseConfigured();

  const result = new Map<string, string | null>();
  if (channelIds.length === 0) {
    return result;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("channels")
    .select("youtube_channel_id, last_upload_at")
    .in("youtube_channel_id", channelIds);

  if (error) {
    throw new Error(`channels last_upload_at lookup failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    result.set(row.youtube_channel_id, row.last_upload_at ?? null);
  }

  return result;
}

export async function loadAutoWatchlistMetricsForChannels(
  channelIds: string[],
  sinceIso: string,
): Promise<Map<string, ChannelAutoWatchlistMetrics>> {
  const [discoveryRecords, lastUploadAtMap] = await Promise.all([
    loadChannelDiscoveryRecords(channelIds, sinceIso),
    loadChannelLastUploadAtMap(channelIds),
  ]);

  const metrics = new Map<string, ChannelAutoWatchlistMetrics>();
  for (const channelId of channelIds) {
    metrics.set(
      channelId,
      aggregateChannelDiscoveryMetrics(
        channelId,
        discoveryRecords.get(channelId) ?? [],
        lastUploadAtMap.get(channelId) ?? null,
      ),
    );
  }

  return metrics;
}
