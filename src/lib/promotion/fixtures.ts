import type { VideoSnapshotRow } from "@/types/database";
import type { GenreVelocityBaseline } from "@/lib/promotion/metrics";

export const REFERENCE_END_MS = Date.parse("2026-07-26T06:00:00.000Z");

export function makeSnapshot(
  videoId: string,
  capturedAt: string,
  viewCount: number,
): VideoSnapshotRow {
  return {
    id: `${videoId}-${capturedAt}`,
    video_id: videoId,
    view_count: viewCount,
    like_count: null,
    comment_count: null,
    subscriber_count: null,
    captured_at: capturedAt,
  };
}

/** Steady growth then a recent acceleration (early growth detection). */
export const risingBreakoutSnapshots = [
  makeSnapshot("video-rising", "2026-07-25T00:00:00.000Z", 100),
  makeSnapshot("video-rising", "2026-07-25T06:00:00.000Z", 130),
  makeSnapshot("video-rising", "2026-07-25T12:00:00.000Z", 160),
  makeSnapshot("video-rising", "2026-07-25T18:00:00.000Z", 190),
  makeSnapshot("video-rising", "2026-07-26T00:00:00.000Z", 220),
  makeSnapshot("video-rising", "2026-07-26T05:00:00.000Z", 280),
  makeSnapshot("video-rising", "2026-07-26T06:00:00.000Z", 340),
];

/** Recent deceleration after a spike. */
export const decliningSnapshots = [
  makeSnapshot("video-declining", "2026-07-25T00:00:00.000Z", 100),
  makeSnapshot("video-declining", "2026-07-25T03:00:00.000Z", 220),
  makeSnapshot("video-declining", "2026-07-25T06:00:00.000Z", 340),
  makeSnapshot("video-declining", "2026-07-26T03:00:00.000Z", 850),
  makeSnapshot("video-declining", "2026-07-26T05:00:00.000Z", 1_060),
  makeSnapshot("video-declining", "2026-07-26T06:00:00.000Z", 1_070),
];

/** Hourly snapshots near the end so 1h velocity is measurable on a large video. */
export const viralSnapshots = [
  makeSnapshot("video-viral", "2026-07-20T00:00:00.000Z", 5_000_000),
  makeSnapshot("video-viral", "2026-07-21T00:00:00.000Z", 5_010_000),
  makeSnapshot("video-viral", "2026-07-22T00:00:00.000Z", 5_020_000),
  makeSnapshot("video-viral", "2026-07-23T00:00:00.000Z", 5_030_000),
  makeSnapshot("video-viral", "2026-07-24T00:00:00.000Z", 5_040_000),
  makeSnapshot("video-viral", "2026-07-25T00:00:00.000Z", 5_050_000),
  makeSnapshot("video-viral", "2026-07-26T04:00:00.000Z", 5_054_000),
  makeSnapshot("video-viral", "2026-07-26T05:00:00.000Z", 5_054_050),
  makeSnapshot("video-viral", "2026-07-26T06:00:00.000Z", 5_054_100),
];

export const defaultGenreBaseline: GenreVelocityBaseline = {
  medianViewsPerHour1h: 20,
  p90ViewsPerHour1h: 50,
  medianViewsPerHour24h: 15,
  sampleCount: 100,
};

export const smallSampleGenreBaseline: GenreVelocityBaseline = {
  medianViewsPerHour1h: 20,
  p90ViewsPerHour1h: 50,
  medianViewsPerHour24h: 15,
  sampleCount: 10,
};

export const trendingGenreBaseline: GenreVelocityBaseline = {
  medianViewsPerHour1h: 20,
  p90ViewsPerHour1h: 200,
  medianViewsPerHour24h: 15,
  sampleCount: 100,
};
