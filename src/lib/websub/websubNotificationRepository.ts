import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { WebsubNotificationStatus } from "@/types/observability";

export interface EnqueueWebsubNotificationInput {
  subscriptionId: string | null;
  topicUrl: string;
  youtubeVideoId: string;
  youtubeChannelId: string;
  entryUpdatedAt?: string | null;
  hubNotificationId?: string | null;
}

export interface EnqueueWebsubNotificationResult {
  id: string;
  status: string;
  isNew: boolean;
}

export interface WebsubNotificationRow {
  id: string;
  subscription_id: string | null;
  dedup_key: string;
  topic_url: string;
  youtube_video_id: string;
  youtube_channel_id: string;
  entry_updated_at: string | null;
  hub_notification_id: string | null;
  status: string;
  received_at: string;
  processed_at: string | null;
  processing_owner: string | null;
  processing_expires_at: string | null;
  attempt_count: number;
  max_attempts: number;
  quota_units_used: number;
  discovery_run_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompleteWebsubNotificationInput {
  id: string;
  status: WebsubNotificationStatus;
  quotaUnitsUsed?: number;
  discoveryRunId?: string | null;
  errorMessage?: string | null;
}

export async function enqueueWebsubNotification(
  input: EnqueueWebsubNotificationInput,
): Promise<EnqueueWebsubNotificationResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("enqueue_websub_notification", {
    p_subscription_id: input.subscriptionId,
    p_topic_url: input.topicUrl,
    p_youtube_video_id: input.youtubeVideoId,
    p_youtube_channel_id: input.youtubeChannelId,
    p_entry_updated_at: input.entryUpdatedAt ?? null,
    p_hub_notification_id: input.hubNotificationId ?? null,
  });

  if (error) {
    throw new Error(`enqueue_websub_notification failed: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; status: string; is_new: boolean }
    | null
    | undefined;

  if (!row) {
    throw new Error("enqueue_websub_notification returned no row");
  }

  return {
    id: row.id,
    status: row.status,
    isNew: row.is_new,
  };
}

export async function claimWebsubNotifications(input: {
  workerId: string;
  batchSize: number;
  processingLeaseSeconds: number;
}): Promise<WebsubNotificationRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_websub_notifications", {
    p_worker_id: input.workerId,
    p_batch_size: input.batchSize,
    p_processing_lease_seconds: input.processingLeaseSeconds,
  });

  if (error) {
    throw new Error(`claim_websub_notifications failed: ${error.message}`);
  }

  return (data ?? []) as WebsubNotificationRow[];
}

export async function completeWebsubNotification(
  input: CompleteWebsubNotificationInput,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("complete_websub_notification", {
    p_id: input.id,
    p_status: input.status,
    p_quota_units_used: input.quotaUnitsUsed ?? 0,
    p_discovery_run_id: input.discoveryRunId ?? null,
    p_error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`complete_websub_notification failed: ${error.message}`);
  }
}

export async function reclaimStaleWebsubNotifications(): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reclaim_stale_websub_notifications");

  if (error) {
    throw new Error(`reclaim_stale_websub_notifications failed: ${error.message}`);
  }

  return typeof data === "number" ? data : 0;
}

export async function releaseWebsubNotificationsToPending(
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) {
    return;
  }

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("websub_notification_log")
    .update({
      status: "pending",
      processing_owner: null,
      processing_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", notificationIds)
    .eq("status", "processing");

  if (error) {
    throw new Error(
      `releaseWebsubNotificationsToPending failed: ${error.message}`,
    );
  }
}
