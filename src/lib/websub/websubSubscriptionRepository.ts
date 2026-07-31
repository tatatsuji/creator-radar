import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { isValidWebsubTopicUrl } from "@/lib/websub/websubTopic";

export interface WebsubSubscriptionRow {
  id: string;
  youtube_channel_id: string;
  topic_url: string;
  status: string;
}

export async function findWebsubSubscriptionByTopic(
  topicUrl: string,
): Promise<WebsubSubscriptionRow | null> {
  if (!isSupabaseConfigured() || !isValidWebsubTopicUrl(topicUrl)) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("websub_subscriptions")
    .select("id,youtube_channel_id,topic_url,status")
    .eq("topic_url", topicUrl)
    .maybeSingle();

  if (error) {
    throw new Error(`websub_subscriptions lookup failed: ${error.message}`);
  }

  return data ?? null;
}

export async function applyWebsubHubVerification(input: {
  topicUrl: string;
  mode: "subscribe" | "unsubscribe";
  leaseSeconds?: number;
  verifiedAt?: Date;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const verifiedAt = input.verifiedAt ?? new Date();
  const supabase = createSupabaseServerClient();

  if (input.mode === "unsubscribe") {
    const { error } = await supabase
      .from("websub_subscriptions")
      .update({
        status: "unsubscribed",
        last_verified_at: verifiedAt.toISOString(),
        updated_at: verifiedAt.toISOString(),
      })
      .eq("topic_url", input.topicUrl);

    if (error) {
      throw new Error(`websub_subscriptions unsubscribe failed: ${error.message}`);
    }

    return;
  }

  const leaseSeconds = input.leaseSeconds ?? 0;
  const leaseExpiresAt = new Date(verifiedAt.getTime() + leaseSeconds * 1000);

  const { error } = await supabase
    .from("websub_subscriptions")
    .update({
      status: "active",
      lease_expires_at: leaseExpiresAt.toISOString(),
      last_verified_at: verifiedAt.toISOString(),
      updated_at: verifiedAt.toISOString(),
    })
    .eq("topic_url", input.topicUrl);

  if (error) {
    throw new Error(`websub_subscriptions verification failed: ${error.message}`);
  }
}
