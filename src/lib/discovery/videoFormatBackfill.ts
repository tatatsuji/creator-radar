import { classifyYouTubeVideoContent } from "@/lib/discovery/videoFormatClassification";
import { classifyYouTubeVideoItem } from "@/lib/discovery/videoClassification";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { fetchYouTubeOEmbedVertical } from "@/lib/youtube/oembed";
import { youtubeFetch } from "@/lib/youtube/client";
import { YOUTUBE_VIDEO_DETAILS_PARTS } from "@/lib/youtube/videoDetailsParts";
import type { YouTubeVideoItem, YouTubeVideosResponse } from "@/lib/youtube/types";
import type { VideoRow } from "@/types/database";

const BATCH_SIZE = 50;
const OEMBED_DELAY_MS = 200;

export interface VideoFormatBackfillSummary {
  totalCandidates: number;
  processed: number;
  updated: number;
  failed: number;
  skipped: number;
  oembedChecked: number;
  oembedVerticalConfirmed: number;
  before: FormatCounts;
  after: FormatCounts;
  dryRun: boolean;
}

export interface FormatCounts {
  regular: number;
  short: number;
  unknown: number;
  liveActive: number;
  liveUpcoming: number;
  liveEnded: number;
  liveUnknown: number;
  liveNone: number;
}

function emptyCounts(): FormatCounts {
  return {
    regular: 0,
    short: 0,
    unknown: 0,
    liveActive: 0,
    liveUpcoming: 0,
    liveEnded: 0,
    liveUnknown: 0,
    liveNone: 0,
  };
}

export function aggregateCounts(
  rows: Pick<VideoRow, "video_format" | "live_state">[],
): FormatCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    if (row.video_format === "regular") counts.regular += 1;
    else if (row.video_format === "short") counts.short += 1;
    else counts.unknown += 1;

    switch (row.live_state) {
      case "active":
        counts.liveActive += 1;
        break;
      case "upcoming":
        counts.liveUpcoming += 1;
        break;
      case "ended":
        counts.liveEnded += 1;
        break;
      case "unknown":
        counts.liveUnknown += 1;
        break;
      case "none":
        counts.liveNone += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}

async function fetchVideoItemsBatch(
  videoIds: string[],
): Promise<Map<string, YouTubeVideoItem>> {
  if (videoIds.length === 0) {
    return new Map();
  }

  const response = await youtubeFetch<YouTubeVideosResponse>(
    "videos",
    {
      part: YOUTUBE_VIDEO_DETAILS_PARTS,
      id: videoIds.join(","),
    },
    videoIds.length,
  );

  const map = new Map<string, YouTubeVideoItem>();
  for (const item of response.items ?? []) {
    if (item.id) {
      map.set(item.id, item);
    }
  }
  return map;
}

function shouldTryOEmbed(
  classification: ReturnType<typeof classifyYouTubeVideoContent>,
): boolean {
  return (
    classification.videoFormat === "unknown" &&
    classification.liveState === "none" &&
    classification.durationSeconds > 0 &&
    classification.durationSeconds <= 180
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function backfillVideoFormatClassification(input: {
  dryRun?: boolean;
  limit?: number;
  useOEmbed?: boolean;
}): Promise<VideoFormatBackfillSummary> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const dryRun = input.dryRun ?? false;
  const useOEmbed = input.useOEmbed ?? true;
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("videos")
    .select("youtube_video_id, video_format, live_state")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false });

  if (input.limit != null) {
    query = query.limit(input.limit);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new Error(`videos lookup failed: ${error.message}`);
  }

  const candidates = (rows ?? []) as Pick<
    VideoRow,
    "youtube_video_id" | "video_format" | "live_state"
  >[];

  const afterRows = candidates.map((row) => ({ ...row }));

  const summary: VideoFormatBackfillSummary = {
    totalCandidates: candidates.length,
    processed: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    oembedChecked: 0,
    oembedVerticalConfirmed: 0,
    before: aggregateCounts(candidates),
    after: emptyCounts(),
    dryRun,
  };

  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + BATCH_SIZE);
    const videoIds = batch.map((row) => row.youtube_video_id);

    let items: Map<string, YouTubeVideoItem>;
    try {
      items = await fetchVideoItemsBatch(videoIds);
    } catch {
      summary.failed += batch.length;
      continue;
    }

    for (let i = 0; i < batch.length; i += 1) {
      const row = batch[i]!;
      const afterIndex = offset + i;
      summary.processed += 1;

      const item = items.get(row.youtube_video_id);
      if (!item) {
        summary.failed += 1;
        continue;
      }

      let verticalConfirmed: boolean | null = null;
      let base = classifyYouTubeVideoContent({
        item,
        fetchStatus: "success",
      });

      if (useOEmbed && shouldTryOEmbed(base)) {
        summary.oembedChecked += 1;
        await sleep(OEMBED_DELAY_MS);
        verticalConfirmed = await fetchYouTubeOEmbedVertical(row.youtube_video_id);
        if (verticalConfirmed === true) {
          summary.oembedVerticalConfirmed += 1;
        }
      }

      const classification = classifyYouTubeVideoItem(item, { verticalConfirmed });
      const checkedAt = new Date().toISOString();

      afterRows[afterIndex] = {
        youtube_video_id: row.youtube_video_id,
        video_format: classification.videoFormat,
        live_state: classification.liveState,
      };

      if (
        row.video_format === classification.videoFormat &&
        row.live_state === classification.liveState
      ) {
        summary.skipped += 1;
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("videos")
          .update({
            video_format: classification.videoFormat,
            live_state: classification.liveState,
            live_broadcast_content: classification.liveBroadcastContent,
            live_scheduled_start_at: classification.liveScheduledStartAt,
            live_actual_start_at: classification.liveActualStartAt,
            live_actual_end_at: classification.liveActualEndAt,
            live_metadata_fetch_status: classification.liveMetadataFetchStatus,
            live_metadata_checked_at: checkedAt,
            format_signals: classification.formatSignals,
            duration_seconds: classification.durationSeconds,
            is_short: classification.isShort,
            is_live: classification.isLive,
          })
          .eq("youtube_video_id", row.youtube_video_id);

        if (updateError) {
          summary.failed += 1;
          continue;
        }
      }

      summary.updated += 1;
    }
  }

  summary.after = aggregateCounts(afterRows);
  return summary;
}

export function formatVideoFormatBackfillSummary(
  summary: VideoFormatBackfillSummary,
): string {
  return JSON.stringify(summary, null, 2);
}
