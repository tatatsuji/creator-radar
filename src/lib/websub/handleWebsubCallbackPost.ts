import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  isWebsubEntryWithinReplayWindow,
  parseWebsubAtomFeed,
} from "@/lib/websub/websubAtomParser";
import { isWebsubEnabled, WEBSUB_CONFIG } from "@/lib/websub/websubConfig";
import { enqueueWebsubNotification } from "@/lib/websub/websubNotificationRepository";
import { verifyWebsubHubSignature } from "@/lib/websub/websubSignature";
import { findWebsubSubscriptionByTopic } from "@/lib/websub/websubSubscriptionRepository";

export interface WebsubCallbackPostResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleWebsubCallbackPost(input: {
  rawBody: string;
  signatureHeader: string | null;
  now?: Date;
}): Promise<WebsubCallbackPostResult> {
  if (!isWebsubEnabled()) {
    return { status: 410, body: { error: "WebSub is disabled" } };
  }

  if (!isSupabaseConfigured()) {
    return { status: 500, body: { error: "Supabase is not configured" } };
  }

  const signatureOk =
    WEBSUB_CONFIG.allowInsecureSignatureBypass ||
    verifyWebsubHubSignature(
      input.rawBody,
      input.signatureHeader,
      WEBSUB_CONFIG.hubSecret,
    );

  if (!signatureOk) {
    return { status: 401, body: { error: "Invalid X-Hub-Signature" } };
  }

  const now = input.now ?? new Date();
  const entries = parseWebsubAtomFeed(input.rawBody);
  let enqueued = 0;
  let skippedStale = 0;
  let skippedUnknownTopic = 0;

  for (const entry of entries) {
    if (
      !isWebsubEntryWithinReplayWindow(
        entry.entryUpdatedAt,
        now,
        WEBSUB_CONFIG.replayMaxAgeMs,
      )
    ) {
      skippedStale += 1;
      continue;
    }

    const subscription = await findWebsubSubscriptionByTopic(entry.topicUrl);
    if (!subscription) {
      skippedUnknownTopic += 1;
      continue;
    }

    await enqueueWebsubNotification({
      subscriptionId: subscription.id,
      topicUrl: entry.topicUrl,
      youtubeVideoId: entry.youtubeVideoId,
      youtubeChannelId: entry.youtubeChannelId,
      entryUpdatedAt: entry.entryUpdatedAt,
      hubNotificationId: entry.hubNotificationId,
    });

    enqueued += 1;
  }

  return {
    status: 202,
    body: {
      accepted: true,
      entriesParsed: entries.length,
      enqueued,
      skippedStale,
      skippedUnknownTopic,
    },
  };
}
