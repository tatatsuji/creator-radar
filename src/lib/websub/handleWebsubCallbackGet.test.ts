import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleWebsubCallbackGet } from "@/lib/websub/handleWebsubCallbackGet";

vi.mock("@/lib/websub/websubConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/websub/websubConfig")>();
  return {
    ...actual,
    isWebsubEnabled: vi.fn(() => true),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/websub/websubSubscriptionRepository", () => ({
  findWebsubSubscriptionByTopic: vi.fn(),
  applyWebsubHubVerification: vi.fn(),
}));

import { isWebsubEnabled } from "@/lib/websub/websubConfig";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  applyWebsubHubVerification,
  findWebsubSubscriptionByTopic,
} from "@/lib/websub/websubSubscriptionRepository";

const topic =
  "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCchannel123";

describe("handleWebsubCallbackGet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isWebsubEnabled).mockReturnValue(true);
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(findWebsubSubscriptionByTopic).mockResolvedValue({
      id: "sub-1",
      youtube_channel_id: "UCchannel123",
      topic_url: topic,
      status: "pending_verify",
    });
    vi.mocked(applyWebsubHubVerification).mockResolvedValue(undefined);
  });

  it("returns 410 when WebSub is disabled", async () => {
    vi.mocked(isWebsubEnabled).mockReturnValue(false);

    const result = await handleWebsubCallbackGet(
      new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.topic": topic,
        "hub.challenge": "challenge-token",
        "hub.lease_seconds": "86400",
      }),
    );

    expect(result.status).toBe(410);
  });

  it("updates lease via hub verification and returns challenge", async () => {
    const result = await handleWebsubCallbackGet(
      new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.topic": topic,
        "hub.challenge": "challenge-token",
        "hub.lease_seconds": "86400",
      }),
    );

    expect(result.status).toBe(200);
    expect(result.body).toBe("challenge-token");
    expect(applyWebsubHubVerification).toHaveBeenCalledWith({
      topicUrl: topic,
      mode: "subscribe",
      leaseSeconds: 86400,
    });
  });

  it("returns 404 for unknown topics", async () => {
    vi.mocked(findWebsubSubscriptionByTopic).mockResolvedValue(null);

    const result = await handleWebsubCallbackGet(
      new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.topic": topic,
        "hub.challenge": "challenge-token",
      }),
    );

    expect(result.status).toBe(404);
  });
});
