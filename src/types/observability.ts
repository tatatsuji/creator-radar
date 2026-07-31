/**
 * Canonical observability domain constants.
 * DB CHECK constraints in 003_phase1_observability_foundation.sql
 * must stay aligned with these values.
 */

export const CHANNEL_TYPES = [
  "creator",
  "company",
  "media",
  "music_official",
  "topic",
  "release",
  "clip",
  "unknown",
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const WATCH_TIERS = [
  "hot",
  "active",
  "normal",
  "cold",
  "archive",
] as const;
export type WatchTier = (typeof WATCH_TIERS)[number];

export const WATCH_STATUSES = [
  "seed",
  "discovered",
  "active",
  "paused",
  "rejected",
  "decayed",
] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const DISCOVERY_SOURCE_TYPES = [
  "seed_channel",
  "watchlist_upload",
  "search",
  "category_search",
  "most_popular",
  "shorts_search",
  /** Short-form candidates via videoDuration=short — not guaranteed to be vertical Shorts. */
  "short_form_candidate",
  "live_search",
  "db_remeasure",
  "related",
  "manual",
  "websub",
  "keyword_search",
  "channel_expansion",
  "auto_watchlist",
] as const;
export type DiscoverySourceType = (typeof DISCOVERY_SOURCE_TYPES)[number];

export const DISCOVERY_RUN_STATUSES = [
  "running",
  "success",
  "partial",
  "failed",
] as const;
export type DiscoveryRunStatus = (typeof DISCOVERY_RUN_STATUSES)[number];

export const DISCOVERY_RUN_TYPES = [
  "watchlist_check",
  "seed_scan",
  "measurement_batch",
  "promotion_batch",
  "ranking_generation",
  "websub_notification",
] as const;
export type DiscoveryRunType = (typeof DISCOVERY_RUN_TYPES)[number];

export const WEBSUB_SUBSCRIPTION_STATUSES = [
  "pending",
  "pending_verify",
  "active",
  "renew_failed",
  "expired",
  "unsubscribed",
  "orphaned",
  "dead",
] as const;
export type WebsubSubscriptionStatus =
  (typeof WEBSUB_SUBSCRIPTION_STATUSES)[number];

export const WEBSUB_SUBSCRIPTION_HEALTH_VALUES = [
  "healthy",
  "degraded",
  "unhealthy",
] as const;
export type WebsubSubscriptionHealth =
  (typeof WEBSUB_SUBSCRIPTION_HEALTH_VALUES)[number];

export const WEBSUB_NOTIFICATION_STATUSES = [
  "pending",
  "processing",
  "processed",
  "skipped_known",
  "duplicate",
  "failed",
  "dead",
] as const;
export type WebsubNotificationStatus =
  (typeof WEBSUB_NOTIFICATION_STATUSES)[number];

export const MEASUREMENT_TIERS = [
  "critical",
  "high",
  "normal",
  "low",
  "archive",
  "hot",
  "active",
  "cold",
] as const;
export type MeasurementTier = (typeof MEASUREMENT_TIERS)[number];

export const MEASUREMENT_STATUSES = [
  "pending",
  "active",
  "paused",
  "failed",
] as const;
export type MeasurementStatus = (typeof MEASUREMENT_STATUSES)[number];

export const VIDEO_AVAILABILITY_STATUSES = [
  "active",
  "unavailable_pending",
  "deleted_or_private",
  "unknown_unavailable",
] as const;
export type VideoAvailabilityStatus =
  (typeof VIDEO_AVAILABILITY_STATUSES)[number];

export const PROMOTION_STATES = [
  "HOT",
  "RISING",
  "TRENDING",
  "STABLE",
  "DECLINING",
] as const;
export type PromotionState = (typeof PROMOTION_STATES)[number];

export const PROMOTION_REASONS = [
  "velocity_threshold",
  "engagement_spike",
  "watchlist_priority",
  "manual_promotion",
] as const;
export type PromotionReason = (typeof PROMOTION_REASONS)[number];

export const PROMOTION_ALGORITHM_VERSIONS = ["promotion-v1"] as const;
export type PromotionAlgorithmVersion =
  (typeof PROMOTION_ALGORITHM_VERSIONS)[number];
export const PROMOTION_ALGORITHM_VERSION: PromotionAlgorithmVersion =
  "promotion-v1";

export const TIER_SYNC_MODES = ["shadow", "active"] as const;
export type TierSyncMode = (typeof TIER_SYNC_MODES)[number];
export const DEFAULT_TIER_SYNC_MODE: TierSyncMode = "shadow";

export const RANKING_PERIODS = ["24h", "3d", "7d", "30d"] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number];

export const GENRE_IDS = [
  "all",
  "shorts",
  "entertainment",
  "music",
  "game",
  "education",
  "news",
  "howto",
  "sports",
  "other",
] as const;
export type GenreId = (typeof GENRE_IDS)[number];

export const SCORE_VERSIONS = ["radar-v1", "radar-v2"] as const;
export type ScoreVersion = (typeof SCORE_VERSIONS)[number];
export const SCORE_VERSION: ScoreVersion = "radar-v1";
export const SCORE_VERSION_V2 = "radar-v2" as const satisfies ScoreVersion;

/** Phase 3 MVP: only 24h/all rankings are generated initially. */
export const RANKING_MVP_PERIODS = ["24h"] as const;
export type RankingMvpPeriod = (typeof RANKING_MVP_PERIODS)[number];

export const RANKING_MVP_GENRES = ["all"] as const;
export type RankingMvpGenre = (typeof RANKING_MVP_GENRES)[number];

export const DISCOVERY_ALGORITHM_VERSIONS = ["discovery-v1"] as const;
export type DiscoveryAlgorithmVersion =
  (typeof DISCOVERY_ALGORITHM_VERSIONS)[number];
export const DISCOVERY_ALGORITHM_VERSION: DiscoveryAlgorithmVersion =
  "discovery-v1";

function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function isChannelType(value: string): value is ChannelType {
  return includesValue(CHANNEL_TYPES, value);
}

export function isWatchTier(value: string): value is WatchTier {
  return includesValue(WATCH_TIERS, value);
}

export function isWatchStatus(value: string): value is WatchStatus {
  return includesValue(WATCH_STATUSES, value);
}

export function isDiscoverySourceType(
  value: string,
): value is DiscoverySourceType {
  return includesValue(DISCOVERY_SOURCE_TYPES, value);
}

export function isDiscoveryRunStatus(
  value: string,
): value is DiscoveryRunStatus {
  return includesValue(DISCOVERY_RUN_STATUSES, value);
}

export function isDiscoveryRunType(value: string): value is DiscoveryRunType {
  return includesValue(DISCOVERY_RUN_TYPES, value);
}

export function isWebsubSubscriptionStatus(
  value: string,
): value is WebsubSubscriptionStatus {
  return includesValue(WEBSUB_SUBSCRIPTION_STATUSES, value);
}

export function isWebsubSubscriptionHealth(
  value: string,
): value is WebsubSubscriptionHealth {
  return includesValue(WEBSUB_SUBSCRIPTION_HEALTH_VALUES, value);
}

export function isWebsubNotificationStatus(
  value: string,
): value is WebsubNotificationStatus {
  return includesValue(WEBSUB_NOTIFICATION_STATUSES, value);
}

export function isMeasurementTier(value: string): value is MeasurementTier {
  return includesValue(MEASUREMENT_TIERS, value);
}

export function isMeasurementStatus(
  value: string,
): value is MeasurementStatus {
  return includesValue(MEASUREMENT_STATUSES, value);
}

export function isVideoAvailabilityStatus(
  value: string,
): value is VideoAvailabilityStatus {
  return includesValue(VIDEO_AVAILABILITY_STATUSES, value);
}

export function isPromotionReason(value: string): value is PromotionReason {
  return includesValue(PROMOTION_REASONS, value);
}

export function isPromotionState(value: string): value is PromotionState {
  return includesValue(PROMOTION_STATES, value);
}

export function isPromotionAlgorithmVersion(
  value: string,
): value is PromotionAlgorithmVersion {
  return includesValue(PROMOTION_ALGORITHM_VERSIONS, value);
}

export function isTierSyncMode(value: string): value is TierSyncMode {
  return includesValue(TIER_SYNC_MODES, value);
}

export function isRankingMvpPeriod(value: string): value is RankingMvpPeriod {
  return includesValue(RANKING_MVP_PERIODS, value);
}

export function isRankingMvpGenre(value: string): value is RankingMvpGenre {
  return includesValue(RANKING_MVP_GENRES, value);
}

export function isRankingPeriod(value: string): value is RankingPeriod {
  return includesValue(RANKING_PERIODS, value);
}

export function isGenreId(value: string): value is GenreId {
  return includesValue(GENRE_IDS, value);
}

export function isScoreVersion(value: string): value is ScoreVersion {
  return includesValue(SCORE_VERSIONS, value);
}

export function isDiscoveryAlgorithmVersion(
  value: string,
): value is DiscoveryAlgorithmVersion {
  return includesValue(DISCOVERY_ALGORITHM_VERSIONS, value);
}

/**
 * Values embedded in migration CHECK constraints.
 * Used by tests to verify SQL/TypeScript alignment.
 */
export const DB_CHECK_CONSTRAINT_VALUES = {
  watch_tier: WATCH_TIERS,
  watch_status: WATCH_STATUSES,
  measurement_tier: MEASUREMENT_TIERS,
  measurement_status: MEASUREMENT_STATUSES,
  discovery_run_status: DISCOVERY_RUN_STATUSES,
  websub_subscription_status: WEBSUB_SUBSCRIPTION_STATUSES,
  websub_subscription_health: WEBSUB_SUBSCRIPTION_HEALTH_VALUES,
  websub_notification_status: WEBSUB_NOTIFICATION_STATUSES,
  ranking_period: RANKING_PERIODS,
  genre: GENRE_IDS,
  score_version_default: SCORE_VERSION,
  discovery_algorithm_version_default: DISCOVERY_ALGORITHM_VERSION,
} as const;

/** Canonical WebSub notification dedup key: `{topic_url}::{youtube_video_id}` */
export function buildWebsubNotificationDedupKey(
  topicUrl: string,
  youtubeVideoId: string,
): string {
  return `${topicUrl}::${youtubeVideoId}`;
}

/**
 * Planned CHECK values for migration 005+ (not applied yet).
 * Used by preview tests only; do not assume these exist in dev DB.
 */
export const FUTURE_DB_CHECK_CONSTRAINT_VALUES = {
  promotion_state: PROMOTION_STATES,
  promotion_reason: PROMOTION_REASONS,
  tier_sync_mode: TIER_SYNC_MODES,
  recommended_measurement_tier: MEASUREMENT_TIERS,
  promotion_algorithm_version_default: PROMOTION_ALGORITHM_VERSION,
  score_version_v2: SCORE_VERSION_V2,
} as const;
