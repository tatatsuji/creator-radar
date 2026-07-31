import { describe, expect, it } from "vitest";

import {
  isWebsubEntryWithinReplayWindow,
  parseWebsubAtomFeed,
} from "@/lib/websub/websubAtomParser";

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>UCchannel123</yt:channelId>
    <updated>2026-07-31T12:00:00+00:00</updated>
  </entry>
  <entry>
    <id>yt:video:def456</id>
    <yt:videoId>def456</yt:videoId>
    <yt:channelId>UCchannel123</yt:channelId>
    <updated>2026-07-20T12:00:00+00:00</updated>
  </entry>
</feed>`;

describe("parseWebsubAtomFeed", () => {
  it("extracts video and channel ids from Atom entries", () => {
    const entries = parseWebsubAtomFeed(SAMPLE_FEED);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      youtubeVideoId: "abc123",
      youtubeChannelId: "UCchannel123",
      topicUrl: "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCchannel123",
      entryUpdatedAt: "2026-07-31T12:00:00+00:00",
      hubNotificationId: "yt:video:abc123",
    });
  });
});

describe("isWebsubEntryWithinReplayWindow", () => {
  it("accepts recent entries", () => {
    expect(
      isWebsubEntryWithinReplayWindow(
        "2026-07-31T12:00:00+00:00",
        new Date("2026-07-31T13:00:00+00:00"),
        7 * 24 * 60 * 60 * 1000,
      ),
    ).toBe(true);
  });

  it("rejects entries older than replay window", () => {
    expect(
      isWebsubEntryWithinReplayWindow(
        "2026-07-01T12:00:00+00:00",
        new Date("2026-07-31T13:00:00+00:00"),
        7 * 24 * 60 * 60 * 1000,
      ),
    ).toBe(false);
  });
});
