import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isWebsubEnabled } from "@/lib/websub/websubConfig";
import { isValidWebsubTopicUrl } from "@/lib/websub/websubTopic";
import {
  applyWebsubHubVerification,
  findWebsubSubscriptionByTopic,
} from "@/lib/websub/websubSubscriptionRepository";

export interface WebsubCallbackGetResult {
  status: number;
  body: string;
  contentType?: string;
}

function readHubParam(
  searchParams: URLSearchParams,
  name: string,
): string | null {
  const value = searchParams.get(name)?.trim();
  return value ? value : null;
}

export async function handleWebsubCallbackGet(
  searchParams: URLSearchParams,
): Promise<WebsubCallbackGetResult> {
  if (!isWebsubEnabled()) {
    return { status: 410, body: "WebSub is disabled" };
  }

  if (!isSupabaseConfigured()) {
    return { status: 500, body: "Supabase is not configured" };
  }

  const mode = readHubParam(searchParams, "hub.mode");
  const topic = readHubParam(searchParams, "hub.topic");
  const challenge = readHubParam(searchParams, "hub.challenge");

  if (!mode || !topic || !challenge) {
    return { status: 400, body: "Missing hub verification parameters" };
  }

  if (mode !== "subscribe" && mode !== "unsubscribe") {
    return { status: 400, body: "Unsupported hub.mode" };
  }

  if (!isValidWebsubTopicUrl(topic)) {
    return { status: 400, body: "Invalid hub.topic" };
  }

  const subscription = await findWebsubSubscriptionByTopic(topic);
  if (!subscription) {
    return { status: 404, body: "Unknown hub.topic" };
  }

  const leaseSecondsRaw = readHubParam(searchParams, "hub.lease_seconds");
  const leaseSeconds = leaseSecondsRaw
    ? Number.parseInt(leaseSecondsRaw, 10)
    : undefined;

  if (mode === "subscribe" && leaseSecondsRaw && (!leaseSeconds || leaseSeconds <= 0)) {
    return { status: 400, body: "Invalid hub.lease_seconds" };
  }

  await applyWebsubHubVerification({
    topicUrl: topic,
    mode,
    leaseSeconds,
  });

  return {
    status: 200,
    body: challenge,
    contentType: "text/plain; charset=utf-8",
  };
}
