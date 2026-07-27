import { listUnscheduledCandidateVideoIds } from "@/lib/measurement/scheduleRepository";
import { upsertSchedule } from "@/lib/measurement/scheduleRepository";
import { recordDiscovery } from "@/lib/discovery/repository";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export interface DbRemeasureResult {
  candidatesProcessed: number;
  schedulesCreated: number;
  schedulesExisting: number;
  discoveriesInserted: number;
  discoveriesDuplicate: number;
  failures: number;
}

export async function registerDbRemeasureCandidates(
  limit: number = OBSERVABILITY_CONFIG.phase1Discovery.dbRemeasureLimit,
): Promise<DbRemeasureResult> {
  if (!isSupabaseConfigured()) {
    return {
      candidatesProcessed: 0,
      schedulesCreated: 0,
      schedulesExisting: 0,
      discoveriesInserted: 0,
      discoveriesDuplicate: 0,
      failures: 0,
    };
  }

  const supabase = createSupabaseServerClient();
  const unscheduledFromDiscoveries = await listUnscheduledCandidateVideoIds();

  const { data: activeVideos, error } = await supabase
    .from("videos")
    .select("youtube_video_id, channel_id")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    throw new Error(`videos lookup for db remeasure failed: ${error.message}`);
  }

  const candidateIds = [
    ...new Set([
      ...unscheduledFromDiscoveries,
      ...(activeVideos ?? []).map((row) => row.youtube_video_id as string),
    ]),
  ].slice(0, limit);

  const result: DbRemeasureResult = {
    candidatesProcessed: 0,
    schedulesCreated: 0,
    schedulesExisting: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    failures: 0,
  };

  for (const videoId of candidateIds) {
    try {
      const channelId =
        (activeVideos ?? []).find((row) => row.youtube_video_id === videoId)
          ?.channel_id ?? null;

      const discoveryResult = await recordDiscovery({
        videoId,
        channelId,
        sourceType: "db_remeasure",
        sourceKey: "active_db_pool",
        metadata: { registrationPath: "db_remeasure" },
      });

      if (discoveryResult === "inserted") {
        result.discoveriesInserted += 1;
      } else {
        result.discoveriesDuplicate += 1;
      }

      const scheduleResult = await upsertSchedule(videoId);
      if (scheduleResult.status === "created") {
        result.schedulesCreated += 1;
      } else {
        result.schedulesExisting += 1;
      }

      result.candidatesProcessed += 1;
    } catch {
      result.failures += 1;
    }
  }

  return result;
}
