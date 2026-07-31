import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

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
