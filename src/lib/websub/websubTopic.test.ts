import { describe, expect, it } from "vitest";

import {
  buildWebsubTopicUrl,
  isValidWebsubTopicUrl,
  parseChannelIdFromWebsubTopic,
} from "@/lib/websub/websubTopic";

describe("websubTopic", () => {
  it("builds the YouTube uploads feed topic URL", () => {
    expect(buildWebsubTopicUrl("UCabc123XYZ")).toBe(
      "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCabc123XYZ",
    );
  });

  it("validates allowed topic URLs", () => {
    const topic = buildWebsubTopicUrl("UCabc123XYZ");
    expect(isValidWebsubTopicUrl(topic)).toBe(true);
    expect(isValidWebsubTopicUrl("https://evil.example/feed")).toBe(false);
  });

  it("parses channel id from topic URL", () => {
    const topic = buildWebsubTopicUrl("UCabc123XYZ");
    expect(parseChannelIdFromWebsubTopic(topic)).toBe("UCabc123XYZ");
    expect(parseChannelIdFromWebsubTopic("invalid")).toBeNull();
  });
});
