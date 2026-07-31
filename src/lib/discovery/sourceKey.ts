import { createHash } from "node:crypto";

const MAX_SEARCH_QUERY_LENGTH = 500;
const MAX_MANUAL_KEY_LENGTH = 120;
const MAX_SOURCE_KEY_LENGTH = 200;
const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[\w-]{10,}$/;
const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;
const REGION_CODE_PATTERN = /^[A-Z]{2}$/;

export class SourceKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceKeyValidationError";
  }
}

function assertNonEmptyString(value: string, fieldName: string): string {
  if (typeof value !== "string") {
    throw new SourceKeyValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new SourceKeyValidationError(`${fieldName} must not be empty`);
  }

  return trimmed;
}

function assertMaxLength(value: string, fieldName: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new SourceKeyValidationError(`${fieldName} is too long`);
  }
}

function assertSourceKeyLength(sourceKey: string): string {
  assertMaxLength(sourceKey, "source_key", MAX_SOURCE_KEY_LENGTH);
  return sourceKey;
}

function assertYouTubeChannelId(channelId: string): string {
  const normalized = assertNonEmptyString(channelId, "channel_id");
  if (!YOUTUBE_CHANNEL_ID_PATTERN.test(normalized)) {
    throw new SourceKeyValidationError("channel_id format is invalid");
  }
  return normalized;
}

function assertYouTubeVideoId(videoId: string): string {
  const normalized = assertNonEmptyString(videoId, "video_id");
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(normalized)) {
    throw new SourceKeyValidationError("video_id format is invalid");
  }
  return normalized;
}

function assertRegionCode(regionCode: string): string {
  const normalized = assertNonEmptyString(regionCode, "region_code").toUpperCase();
  if (!REGION_CODE_PATTERN.test(normalized)) {
    throw new SourceKeyValidationError("region_code format is invalid");
  }
  return normalized;
}

function assertCategoryId(categoryId: string): string {
  const normalized = assertNonEmptyString(categoryId, "category_id");
  if (!/^\d+$/.test(normalized)) {
    throw new SourceKeyValidationError("category_id must be numeric");
  }
  return normalized;
}

function assertManualKey(manualKey: string): string {
  const normalized = assertNonEmptyString(manualKey, "manual_key");
  assertMaxLength(normalized, "manual_key", MAX_MANUAL_KEY_LENGTH);

  if (/[\r\n\t]/.test(normalized)) {
    throw new SourceKeyValidationError("manual_key contains invalid whitespace");
  }

  return normalized;
}

function assertThemeKey(themeKey: string): string {
  const normalized = assertNonEmptyString(themeKey, "theme_key");
  assertMaxLength(normalized, "theme_key", MAX_SEARCH_QUERY_LENGTH);
  return normalized;
}

/**
 * Normalizes a search query for stable hashing.
 * - Trims leading/trailing whitespace
 * - Collapses consecutive whitespace
 * - Lowercases (case-insensitive dedup)
 */
export function normalizeSearchQuery(query: string): string {
  const trimmed = assertNonEmptyString(query, "search_query");
  assertMaxLength(trimmed, "search_query", MAX_SEARCH_QUERY_LENGTH);

  return trimmed.replace(/\s+/g, " ").toLowerCase();
}

/** Returns a stable hash token. Raw query text is never returned. */
export function hashSearchQuery(query: string): string {
  const normalized = normalizeSearchQuery(query);
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `q:${digest.slice(0, 16)}`;
}

export function buildSeedSourceKey(channelId: string): string {
  return assertSourceKeyLength(assertYouTubeChannelId(channelId));
}

export function buildWatchlistUploadSourceKey(channelId: string): string {
  return assertSourceKeyLength(assertYouTubeChannelId(channelId));
}

export function buildWebsubSourceKey(
  channelId: string,
  videoId: string,
): string {
  return assertSourceKeyLength(
    `websub:${assertYouTubeChannelId(channelId)}:${assertYouTubeVideoId(videoId)}`,
  );
}

export function buildSearchSourceKey(query: string): string {
  return assertSourceKeyLength(hashSearchQuery(query));
}

export function buildCategorySearchSourceKey(
  categoryId: string,
  query: string,
): string {
  const category = assertCategoryId(categoryId);
  const queryHash = hashSearchQuery(query);
  return assertSourceKeyLength(`${category}:${queryHash}`);
}

export function buildMostPopularSourceKey(
  regionCode: string,
  categoryOrAll: string,
): string {
  const region = assertRegionCode(regionCode);
  const categoryPart =
    categoryOrAll === "all" ? "all" : assertCategoryId(categoryOrAll);

  return assertSourceKeyLength(`${region}:${categoryPart}`);
}

export function buildManualSourceKey(manualKey: string): string {
  const normalized = assertManualKey(manualKey);
  return assertSourceKeyLength(`manual:${normalized}`);
}

export function buildRelatedSourceKey(input: {
  originVideoId?: string;
  themeKey?: string;
}): string {
  if (input.originVideoId) {
    const videoId = assertYouTubeVideoId(input.originVideoId);
    return assertSourceKeyLength(`origin:${videoId}`);
  }

  if (input.themeKey) {
    const themeHash = hashSearchQuery(assertThemeKey(input.themeKey));
    return assertSourceKeyLength(`theme:${themeHash}`);
  }

  throw new SourceKeyValidationError(
    "related source requires originVideoId or themeKey",
  );
}
