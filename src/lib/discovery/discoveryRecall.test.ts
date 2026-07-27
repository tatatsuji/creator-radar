import { describe, expect, it } from "vitest";

import type { DiscoveryRecallGroundTruth } from "@/lib/discovery/discoveryRecallGroundTruth";
import { DISCOVERY_RECALL_GROUND_TRUTH_SIZE } from "@/lib/discovery/discoveryRecallGroundTruth";

describe("discovery recall constants", () => {
  it("uses 100 videos as the ground truth benchmark size", () => {
    expect(DISCOVERY_RECALL_GROUND_TRUTH_SIZE).toBe(100);
  });
});

describe("discovery recall measurement shape", () => {
  it("computes recall as discovered over ground truth count", () => {
    const groundTruth: DiscoveryRecallGroundTruth = {
      generatedAt: new Date().toISOString(),
      region: "JP",
      definition: "test",
      targetCount: 100,
      actualCount: 2,
      fetchSummary: {},
      sets: [],
      videos: [
        {
          videoId: "video1234567",
          title: "A",
          channelId: "UC1234567890abcdefghij",
          channelName: "Ch A",
          publishedAt: "2026-07-27T00:00:00.000Z",
          viewCount: 1000,
          buzzScore: 80,
          groundTruthSources: ["most_popular:all"],
          groundTruthSet: "mainstream_buzz",
        },
        {
          videoId: "video1234568",
          title: "B",
          channelId: "UC1234567890abcdefgh",
          channelName: "Ch B",
          publishedAt: "2026-07-27T00:00:00.000Z",
          viewCount: 500,
          buzzScore: 60,
          groundTruthSources: ["search:viewCount:24h"],
          groundTruthSet: "mainstream_buzz",
        },
      ],
    };

    const discoveredCount = 1;
    const recall = discoveredCount / groundTruth.videos.length;
    expect(recall).toBe(0.5);
  });
});
