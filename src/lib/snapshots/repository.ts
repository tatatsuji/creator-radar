import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type {
  FinishSnapshotRunInput,
  InsertChannelSnapshotInput,
  InsertSnapshotInput,
  SnapshotInsertResult,
  SnapshotRunRow,
  UpsertChannelInput,
  UpsertVideoInput,
  VideoSnapshotRow,
} from "@/types/database";
import { inferSnapshotRunTypeFromLegacySignals } from "@/types/snapshotRuns";

const SNAPSHOT_RUN_TYPE = {
  legacy: "legacy_snapshot",
  measurement: "measurement",
} as const;

const SNAPSHOT_DEDUP_WINDOW_MS = 50 * 60 * 1000;
const RUNNING_RUN_WINDOW_MS = 10 * 60 * 1000;

function isMissingRunTypeColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "42703" ||
    error.message?.includes("run_type") === true ||
    error.message?.includes("schema cache") === true
  );
}

async function hasRecentSnapshot(
  table: "video_snapshots" | "channel_snapshots",
  idColumn: "video_id" | "channel_id",
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const since = new Date(Date.now() - SNAPSHOT_DEDUP_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from(table)
    .select("captured_at")
    .eq(idColumn, id)
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`${table} recent lookup failed: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

export async function findRecentRunningSnapshotRun(): Promise<SnapshotRunRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const since = new Date(Date.now() - RUNNING_RUN_WINDOW_MS).toISOString();

  const typedQuery = await supabase
    .from("snapshot_runs")
    .select("*")
    .eq("status", "running")
    .eq("run_type", SNAPSHOT_RUN_TYPE.legacy)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (typedQuery.error && !isMissingRunTypeColumnError(typedQuery.error)) {
    throw new Error(`snapshot_runs lookup failed: ${typedQuery.error.message}`);
  }

  if (!typedQuery.error) {
    return (typedQuery.data as SnapshotRunRow | null) ?? null;
  }

  const { data, error } = await supabase
    .from("snapshot_runs")
    .select("*")
    .eq("status", "running")
    .is("error_summary", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`snapshot_runs lookup failed: ${error.message}`);
  }

  return (data as SnapshotRunRow | null) ?? null;
}

export async function createSnapshotRun(): Promise<string> {
  const supabase = createSupabaseServerClient();

  const typedInsert = await supabase
    .from("snapshot_runs")
    .insert({
      status: "running",
      run_type: SNAPSHOT_RUN_TYPE.legacy,
    })
    .select("id")
    .single();

  if (typedInsert.error && !isMissingRunTypeColumnError(typedInsert.error)) {
    throw new Error(`snapshot_runs insert failed: ${typedInsert.error.message}`);
  }

  if (!typedInsert.error) {
    return typedInsert.data.id as string;
  }

  const { data, error } = await supabase
    .from("snapshot_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`snapshot_runs insert failed: ${error.message}`);
  }

  return data.id as string;
}

export async function createMeasurementSnapshotRun(): Promise<string> {
  const supabase = createSupabaseServerClient();
  const runningMarker = JSON.stringify({
    type: "measurement",
    phase: "running",
  });

  const typedInsert = await supabase
    .from("snapshot_runs")
    .insert({
      status: "running",
      run_type: SNAPSHOT_RUN_TYPE.measurement,
      error_summary: runningMarker,
    })
    .select("id")
    .single();

  if (typedInsert.error && !isMissingRunTypeColumnError(typedInsert.error)) {
    throw new Error(
      `measurement snapshot_runs insert failed: ${typedInsert.error.message}`,
    );
  }

  if (!typedInsert.error) {
    return typedInsert.data.id as string;
  }

  const { data, error } = await supabase
    .from("snapshot_runs")
    .insert({
      status: "running",
      error_summary: runningMarker,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`measurement snapshot_runs insert failed: ${error.message}`);
  }

  return data.id as string;
}

export async function finishSnapshotRun(
  runId: string,
  input: FinishSnapshotRunInput,
): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("snapshot_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: input.status,
      videos_total: input.videosTotal,
      videos_success: input.videosSuccess,
      videos_failed: input.videosFailed,
      videos_skipped: input.videosSkipped,
      channels_total: input.channelsTotal,
      channels_success: input.channelsSuccess,
      channels_skipped: input.channelsSkipped,
      youtube_quota_used: input.youtubeQuotaUsed,
      error_summary: input.errorSummary ?? null,
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`snapshot_runs update failed: ${error.message}`);
  }
}

export async function upsertChannelRecord(
  input: UpsertChannelInput,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("channels").upsert(
    {
      youtube_channel_id: input.youtubeChannelId,
      name: input.name,
      thumbnail_url: input.thumbnailUrl ?? null,
      subscriber_count_hidden: input.subscriberCountHidden,
      updated_at: now,
    },
    { onConflict: "youtube_channel_id" },
  );

  if (error) {
    throw new Error(`channels upsert failed: ${error.message}`);
  }
}

export async function upsertVideoRecord(input: UpsertVideoInput): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("videos").upsert(
    {
      youtube_video_id: input.youtubeVideoId,
      title: input.title,
      channel_id: input.channelId,
      channel_name: input.channelName,
      thumbnail_url: input.thumbnailUrl,
      published_at: input.publishedAt,
      category_id: input.categoryId ?? null,
      is_active: true,
      last_seen_at: input.lastSeenAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "youtube_video_id" },
  );

  if (error) {
    throw new Error(`videos upsert failed: ${error.message}`);
  }
}

export async function insertVideoSnapshotIfNeeded(
  input: InsertSnapshotInput,
): Promise<SnapshotInsertResult> {
  if (await hasRecentSnapshot("video_snapshots", "video_id", input.videoId)) {
    return "skipped";
  }

  return insertVideoSnapshotRaw(input);
}

export async function insertVideoSnapshotRaw(
  input: InsertSnapshotInput,
): Promise<SnapshotInsertResult> {
  const supabase = createSupabaseServerClient();
  const capturedAt = input.capturedAt ?? new Date().toISOString();

  const { error } = await supabase.from("video_snapshots").insert({
    video_id: input.videoId,
    view_count: input.viewCount,
    like_count: input.likeCount ?? null,
    comment_count: input.commentCount ?? null,
    captured_at: capturedAt,
  });

  if (error) {
    if (isDuplicateKeyError(error)) {
      return "skipped";
    }

    throw new Error(`video_snapshots insert failed: ${error.message}`);
  }

  return "inserted";
}

export async function updateVideoLastObservedAt(
  videoId: string,
  observedAt: string,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("videos")
    .update({
      last_observed_at: observedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("youtube_video_id", videoId);

  if (error) {
    throw new Error(`videos last_observed_at update failed: ${error.message}`);
  }
}

export async function countVideoSnapshots(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("video_snapshots")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`video_snapshots count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function countVideoSnapshotsSince(sinceIso: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("video_snapshots")
    .select("*", { count: "exact", head: true })
    .gte("captured_at", sinceIso);

  if (error) {
    throw new Error(`video_snapshots since count failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function getLatestVideoSnapshotCapturedAt(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_snapshots")
    .select("captured_at")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`video_snapshots latest lookup failed: ${error.message}`);
  }

  return (data?.captured_at as string | undefined) ?? null;
}

export async function countDistinctVideosWithSnapshots(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_snapshots")
    .select("video_id");

  if (error) {
    throw new Error(`video_snapshots distinct count failed: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.video_id)).size;
}

export async function countVideosWithMultipleSnapshots(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_snapshots")
    .select("video_id");

  if (error) {
    throw new Error(`video_snapshots multi count failed: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.video_id, (counts.get(row.video_id) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count >= 2).length;
}

export async function getLatestMeasurementRun(): Promise<SnapshotRunRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const typedQuery = await supabase
    .from("snapshot_runs")
    .select("*")
    .eq("run_type", SNAPSHOT_RUN_TYPE.measurement)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (typedQuery.error && !isMissingRunTypeColumnError(typedQuery.error)) {
    throw new Error(`measurement snapshot_runs lookup failed: ${typedQuery.error.message}`);
  }

  if (!typedQuery.error) {
    return (typedQuery.data as SnapshotRunRow | null) ?? null;
  }

  const { data, error } = await supabase
    .from("snapshot_runs")
    .select("*")
    .like("error_summary", "%\"type\":\"measurement\"%")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`measurement snapshot_runs lookup failed: ${error.message}`);
  }

  return (data as SnapshotRunRow | null) ?? null;
}

export async function listMeasurementRunsSince(
  sinceIso: string,
): Promise<SnapshotRunRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const typedQuery = await supabase
    .from("snapshot_runs")
    .select("*")
    .eq("run_type", SNAPSHOT_RUN_TYPE.measurement)
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });

  if (typedQuery.error && !isMissingRunTypeColumnError(typedQuery.error)) {
    throw new Error(`measurement runs lookup failed: ${typedQuery.error.message}`);
  }

  if (!typedQuery.error) {
    return (typedQuery.data ?? []) as SnapshotRunRow[];
  }

  const { data, error } = await supabase
    .from("snapshot_runs")
    .select("*")
    .like("error_summary", "%\"type\":\"measurement\"%")
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(`measurement runs lookup failed: ${error.message}`);
  }

  return (data ?? []) as SnapshotRunRow[];
}

export async function findRecentRunningMeasurementRun(): Promise<SnapshotRunRow | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const since = new Date(Date.now() - RUNNING_RUN_WINDOW_MS).toISOString();

  const typedQuery = await supabase
    .from("snapshot_runs")
    .select("*")
    .eq("status", "running")
    .eq("run_type", SNAPSHOT_RUN_TYPE.measurement)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (typedQuery.error && !isMissingRunTypeColumnError(typedQuery.error)) {
    throw new Error(`measurement snapshot_runs lookup failed: ${typedQuery.error.message}`);
  }

  if (!typedQuery.error) {
    return (typedQuery.data as SnapshotRunRow | null) ?? null;
  }

  const { data, error } = await supabase
    .from("snapshot_runs")
    .select("*")
    .eq("status", "running")
    .like("error_summary", "%\"type\":\"measurement\"%")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`measurement snapshot_runs lookup failed: ${error.message}`);
  }

  return (data as SnapshotRunRow | null) ?? null;
}

export async function countVideosWithSnapshotCountAtLeast(
  minimumCount: number,
  videoIds?: string[],
): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const supabase = createSupabaseServerClient();
  let query = supabase.from("video_snapshots").select("video_id");
  if (videoIds && videoIds.length > 0) {
    query = query.in("video_id", videoIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`video_snapshots count lookup failed: ${error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.video_id, (counts.get(row.video_id) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count >= minimumCount).length;
}

export async function computeMaxSnapshotGapHours(
  videoIds: string[],
): Promise<number | null> {
  if (!isSupabaseConfigured() || videoIds.length === 0) {
    return null;
  }

  const snapshotsByVideo = await fetchSnapshotsForVideos(videoIds);
  let maxGapHours: number | null = null;

  for (const videoId of videoIds) {
    const snapshots = snapshotsByVideo.get(videoId) ?? [];
    for (let index = 1; index < snapshots.length; index += 1) {
      const gapHours =
        (Date.parse(snapshots[index].captured_at) -
          Date.parse(snapshots[index - 1].captured_at)) /
        (60 * 60 * 1000);
      maxGapHours = maxGapHours === null ? gapHours : Math.max(maxGapHours, gapHours);
    }
  }

  return maxGapHours;
}

export function resolveSnapshotRunType(row: SnapshotRunRow): SnapshotRunRow["run_type"] {
  return inferSnapshotRunTypeFromLegacySignals({
    runType: row.run_type,
    channelsTotal: row.channels_total,
    errorSummary: row.error_summary,
    status: row.status,
  });
}

export async function insertChannelSnapshotIfNeeded(
  input: InsertChannelSnapshotInput,
): Promise<SnapshotInsertResult> {
  if (await hasRecentSnapshot("channel_snapshots", "channel_id", input.channelId)) {
    return "skipped";
  }

  const supabase = createSupabaseServerClient();
  const capturedAt = input.capturedAt ?? new Date().toISOString();

  const { error } = await supabase.from("channel_snapshots").insert({
    channel_id: input.channelId,
    subscriber_count: input.subscriberCount,
    captured_at: capturedAt,
  });

  if (error) {
    if (isDuplicateKeyError(error)) {
      return "skipped";
    }

    throw new Error(`channel_snapshots insert failed: ${error.message}`);
  }

  return "inserted";
}

/** @deprecated Use insertVideoSnapshotIfNeeded */
export async function insertVideoSnapshot(
  input: InsertSnapshotInput,
): Promise<void> {
  await insertVideoSnapshotIfNeeded(input);
}

export async function fetchSnapshotsForVideo(
  videoId: string,
): Promise<VideoSnapshotRow[]> {
  const map = await fetchSnapshotsForVideos([videoId]);
  return map.get(videoId) ?? [];
}

export async function fetchSnapshotsForVideoInRange(
  videoId: string,
  rangeHours: number,
): Promise<VideoSnapshotRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const since = new Date(Date.now() - rangeHours * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_snapshots")
    .select("id, video_id, view_count, like_count, comment_count, captured_at")
    .eq("video_id", videoId)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });

  if (error) {
    throw new Error(`video_snapshots range fetch failed: ${error.message}`);
  }

  return (data ?? []) as VideoSnapshotRow[];
}

export async function fetchSnapshotsForVideos(
  videoIds: string[],
): Promise<Map<string, VideoSnapshotRow[]>> {
  const result = new Map<string, VideoSnapshotRow[]>();

  if (!isSupabaseConfigured() || videoIds.length === 0) {
    return result;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_snapshots")
    .select("id, video_id, view_count, like_count, comment_count, captured_at")
    .in("video_id", videoIds)
    .order("captured_at", { ascending: true });

  if (error) {
    throw new Error(`video_snapshots fetch failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    const snapshots = result.get(row.video_id) ?? [];
    snapshots.push(row as VideoSnapshotRow);
    result.set(row.video_id, snapshots);
  }

  return result;
}
