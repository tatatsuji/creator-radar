import { beforeEach, describe, expect, it, vi } from "vitest";

import { computeWebsubHubSignature } from "@/lib/websub/websubSignature";
import { handleWebsubCallbackPost } from "@/lib/websub/handleWebsubCallbackPost";

vi.mock("@/lib/websub/websubConfig", () => ({
  isWebsubEnabled: vi.fn(() => true),
  WEBSUB_CONFIG: {
    enabled: true,
    hubSecret: "test-secret",
    replayMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
    topicUrlPattern:
      /^https:\/\/www\.youtube\.com\/xml\/feeds\/videos\.xml\?channel_id=UC[\w-]+$/,
    allowInsecureSignatureBypass: false,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/websub/websubSubscriptionRepository", () => ({
  findWebsubSubscriptionByTopic: vi.fn(),
}));

vi.mock("@/lib/websub/websubNotificationRepository", () => ({
  enqueueWebsubNotification: vi.fn(),
}));

import { isWebsubEnabled } from "@/lib/websub/websubConfig";
import { enqueueWebsubNotification } from "@/lib/websub/websubNotificationRepository";
import { findWebsubSubscriptionByTopic } from "@/lib/websub/websubSubscriptionRepository";

const topic =
  "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCchannel123";

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UCchannel123</yt:channelId>
    <updated>2026-07-31T12:00:00+00:00</updated>
  </entry>
</feed>`;

describe("handleWebsubCallbackPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isWebsubEnabled).mockReturnValue(true);
    vi.mocked(findWebsubSubscriptionByTopic).mockResolvedValue({
      id: "sub-1",
      youtube_channel_id: "UCchannel123",
      topic_url: topic,
      status: "active",
    });
    vi.mocked(enqueueWebsubNotification).mockResolvedValue({
      id: "log-1",
      status: "pending",
      isNew: true,
    });
  });

  it("returns 410 when WebSub is disabled", async () => {
    vi.mocked(isWebsubEnabled).mockReturnValue(false);

    const result = await handleWebsubCallbackPost({
      rawBody: SAMPLE_FEED,
      signatureHeader: null,
    });

    expect(result.status).toBe(410);
    expect(enqueueWebsubNotification).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid signatures", async () => {
    const result = await handleWebsubCallbackPost({
      rawBody: SAMPLE_FEED,
      signatureHeader: "sha1=invalid",
    });

    expect(result.status).toBe(401);
    expect(enqueueWebsubNotification).not.toHaveBeenCalled();
  });

  it("enqueues notifications and returns 202 without calling discovery APIs", async () => {
    const signature = `sha1=${computeWebsubHubSignature(SAMPLE_FEED, "test-secret")}`;

    const result = await handleWebsubCallbackPost({
      rawBody: SAMPLE_FEED,
      signatureHeader: signature,
      now: new Date("2026-07-31T13:00:00+00:00"),
    });

    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({
      accepted: true,
      enqueued: 1,
    });
    expect(enqueueWebsubNotification).toHaveBeenCalledWith({
      subscriptionId: "sub-1",
      topicUrl: topic,
      youtubeVideoId: "abc123",
      youtubeChannelId: "UCchannel123",
      entryUpdatedAt: "2026-07-31T12:00:00+00:00",
      hubNotificationId: "yt:video:abc123",
    });
  });

  it("skips stale entries without enqueueing", async () => {
    const staleFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UCchannel123</yt:channelId>
    <updated>2026-07-01T12:00:00+00:00</updated>
  </entry>
</feed>`;
    const signature = `sha1=${computeWebsubHubSignature(staleFeed, "test-secret")}`;

    const result = await handleWebsubCallbackPost({
      rawBody: staleFeed,
      signatureHeader: signature,
      now: new Date("2026-07-31T13:00:00+00:00"),
    });

    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({
      enqueued: 0,
      skippedStale: 1,
    });
    expect(enqueueWebsubNotification).not.toHaveBeenCalled();
  });
});
