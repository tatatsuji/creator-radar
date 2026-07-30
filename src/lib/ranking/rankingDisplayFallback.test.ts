import { describe, expect, it, vi, beforeEach } from "vitest";

import { passesBuzzQualityGate } from "@/lib/ranking/buzzRankingQuality";
import { mergeSnapshotMetricsIntoVideos } from "@/lib/ranking/snapshotMetrics";
import { mapVideoRowToVideo } from "@/lib/ranking/snapshotRankingBase";
import type { VideoRow, VideoSnapshotRow } from "@/types/database";
import type { Video } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/snapshots/repository", () => ({
  fetchSnapshotsForVideos: vi.fn(),
}));

import { fetchSnapshotsForVideos } from "@/lib/snapshots/repository";

function makeVideoRow(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    youtube_video_id: "abc12345678",
    title: "Test Video",
    description: null,
    channel_id: "UC1234567890abcdefghij",
    channel_name: "Test Channel",
    thumbnail_url: "https://example.com/thumb.jpg",
    published_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    category_id: "20",
    is_active: true,
    last_seen_at: new Date().toISOString(),
    duration_seconds: 600,
    is_short: false,
    is_live: false,
    is_topic_content: false,
    first_discovered_at: null,
    last_observed_at: null,
    view_count: 530_934,
    like_count: null,
    comment_count: null,
    tags: null,
    content_features: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSnapshot(viewCount: number): VideoSnapshotRow {
  return {
    id: "snap-1",
    video_id: "abc12345678",
    view_count: viewCount,
    like_count: null,
    comment_count: null,
    subscriber_count: 10_000,
    captured_at: new Date().toISOString(),
  };
}

function makeCandidateVideo(viewCount: number): Video & {
  metrics: Video["metrics"] & { rawScore?: number };
} {
  return {
    id: "abc12345678",
    title: "Test Video",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    channel: {
      id: "UC1234567890abcdefghij",
      name: "Test Channel",
      subscriberCount: 10_000,
      subscriberCountHidden: false,
    },
    viewCount,
    metrics: {
      period: "24h",
      viewDelta: 0,
      viewVelocity: 0,
      viewsPerSubscriber: 0,
      rankingScore: 0,
      metricsSource: "estimated",
    },
  };
}

describe("ranking display fallback", () => {
  beforeEach(() => {
    vi.mocked(fetchSnapshotsForVideos).mockReset();
  });

  it("uses videos.view_count when no snapshot exists", () => {
    const video = mapVideoRowToVideo(makeVideoRow({ view_count: 530_934 }), undefined, "24h");

    expect(video.viewCount).toBe(530_934);
  });

  it("prefers latest snapshot view_count over videos.view_count", () => {
    const video = mapVideoRowToVideo(
      makeVideoRow({ view_count: 530_934 }),
      makeSnapshot(600_000),
      "24h",
    );

    expect(video.viewCount).toBe(600_000);
  });

  it("computes estimated metrics when fewer than 2 snapshots", async () => {
    vi.mocked(fetchSnapshotsForVideos).mockResolvedValue(
      new Map([["abc12345678", []]]),
    );

    const { videos } = await mergeSnapshotMetricsIntoVideos(
      [makeCandidateVideo(100_000)],
      "24h",
    );

    expect(videos[0]?.metrics.metricsSource).toBe("estimated");
    expect(videos[0]?.metrics.rankingScore).toBeGreaterThan(0);
    expect(videos[0]?.metrics.viewVelocity).toBeGreaterThan(0);
    expect(passesBuzzQualityGate(videos[0]!, "24h")).toBe(true);
  });
});
