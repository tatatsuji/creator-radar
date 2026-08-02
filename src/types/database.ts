export interface VideoSnapshotRow {
  id: string;
  video_id: string;
  view_count: number;
  like_count: number | null;
  comment_count: number | null;
  subscriber_count: number | null;
  captured_at: string;
}

export interface VideoRow {
  youtube_video_id: string;
  title: string | null;
  description: string | null;
  channel_id: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  category_id: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  duration_seconds: number | null;
  is_short: boolean | null;
  is_live: boolean | null;
  video_format: "short" | "regular" | "unknown" | null;
  live_state: "none" | "active" | "upcoming" | "ended" | "unknown" | null;
  live_broadcast_content: string | null;
  live_scheduled_start_at: string | null;
  live_actual_start_at: string | null;
  live_actual_end_at: string | null;
  live_metadata_fetch_status: "success" | "failed" | "not_checked" | null;
  live_metadata_checked_at: string | null;
  format_signals: Record<string, unknown> | null;
  is_topic_content: boolean | null;
  first_discovered_at: string | null;
  last_discovered_at: string | null;
  discovery_count: number | null;
  last_observed_at: string | null;
  availability_status: string | null;
  unavailable_count: number | null;
  last_available_at: string | null;
  first_unavailable_at: string | null;
  last_unavailable_at: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  tags: string[] | null;
  content_features: import("@/lib/discovery/videoFeatures").VideoContentFeatures | null;
  updated_at: string;
}

export interface ChannelRow {
  youtube_channel_id: string;
  name: string | null;
  thumbnail_url: string | null;
  subscriber_count_hidden: boolean;
  subscriber_count: number | null;
  channel_type: string | null;
  market_relevance: number | null;
  country: string | null;
  default_language: string | null;
  last_upload_at: string | null;
  uploads_playlist_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelSnapshotRow {
  id: string;
  channel_id: string;
  subscriber_count: number | null;
  captured_at: string;
}

export type SnapshotRunStatus = "running" | "success" | "partial" | "failed";

export type SnapshotRunType = "legacy_snapshot" | "measurement";

export interface SnapshotRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: SnapshotRunStatus;
  run_type: SnapshotRunType | null;
  videos_total: number;
  videos_success: number;
  videos_failed: number;
  videos_skipped: number;
  channels_total: number;
  channels_success: number;
  channels_skipped: number;
  youtube_quota_used: number;
  error_summary: string | null;
}

export interface UpsertChannelInput {
  youtubeChannelId: string;
  name: string;
  thumbnailUrl?: string;
  subscriberCountHidden: boolean;
  subscriberCount?: number | null;
}

export interface UpsertVideoInput {
  youtubeVideoId: string;
  title: string;
  description?: string | null;
  channelId: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
  categoryId?: string;
  lastSeenAt: string;
  durationSeconds?: number | null;
  isShort?: boolean | null;
  isLive?: boolean | null;
  videoFormat?: "short" | "regular" | "unknown" | null;
  liveState?: "none" | "active" | "upcoming" | "ended" | "unknown" | null;
  liveBroadcastContent?: string | null;
  liveScheduledStartAt?: string | null;
  liveActualStartAt?: string | null;
  liveActualEndAt?: string | null;
  liveMetadataFetchStatus?: "success" | "failed" | "not_checked" | null;
  liveMetadataCheckedAt?: string | null;
  formatSignals?: Record<string, unknown> | null;
  isTopicContent?: boolean | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  tags?: string[] | null;
  contentFeatures?: import("@/lib/discovery/videoFeatures").VideoContentFeatures | null;
}

export interface InsertSnapshotInput {
  videoId: string;
  viewCount: number;
  likeCount?: number | null;
  commentCount?: number | null;
  subscriberCount?: number | null;
  capturedAt?: string;
}

export interface InsertChannelSnapshotInput {
  channelId: string;
  subscriberCount: number | null;
  capturedAt?: string;
}

export type SnapshotInsertResult = "inserted" | "skipped";

export interface FinishSnapshotRunInput {
  status: SnapshotRunStatus;
  videosTotal: number;
  videosSuccess: number;
  videosFailed: number;
  videosSkipped: number;
  channelsTotal: number;
  channelsSuccess: number;
  channelsSkipped: number;
  youtubeQuotaUsed: number;
  errorSummary?: string | null;
}

export interface ChannelWatchlistRow {
  id: string;
  channel_id: string;
  name: string | null;
  category: string | null;
  source: string | null;
  priority: number;
  notes: string | null;
  watch_tier: string;
  watch_status: string;
  next_check_at: string | null;
  last_checked_at: string | null;
  failure_count: number;
  lock_token: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateDiscoveryRow {
  id: string;
  video_id: string;
  channel_id: string | null;
  source_type: string;
  source_key: string;
  discovered_at: string;
  metadata: Record<string, unknown> | null;
}

export interface MeasurementScheduleRow {
  video_id: string;
  measurement_tier: string;
  measurement_status: string;
  next_measurement_at: string | null;
  last_measured_at: string | null;
  failure_count: number;
  lock_token: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryRunRow {
  id: string;
  run_type: string;
  status: string;
  algorithm_version: string;
  started_at: string;
  finished_at: string | null;
  cursor: string | null;
  items_processed: number;
  items_discovered: number;
  items_failed: number;
  youtube_quota_estimate: number;
  error_summary: string | null;
  metadata: Record<string, unknown> | null;
}

export interface RankingSnapshotRow {
  id: string;
  batch_id: string;
  generated_at: string;
  period: string;
  genre: string;
  video_id: string;
  rank: number;
  radar_score: number | null;
  score_version: string;
  metadata: Record<string, unknown> | null;
}
