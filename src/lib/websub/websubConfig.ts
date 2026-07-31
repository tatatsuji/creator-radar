function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return fallback;
}

/** Feature flag — default OFF for canary rollout. */
export const WEBSUB_ENABLED = readBoolean(process.env.WEBSUB_ENABLED, false);

export const WEBSUB_HUB_SECRET = process.env.WEBSUB_HUB_SECRET?.trim() ?? "";

export const WEBSUB_REPLAY_MAX_AGE_MS =
  readPositiveInt(process.env.WEBSUB_REPLAY_MAX_AGE_DAYS, 7) * 24 * 60 * 60 * 1000;

export const WEBSUB_TOPIC_URL_PATTERN =
  /^https:\/\/www\.youtube\.com\/xml\/feeds\/videos\.xml\?channel_id=UC[\w-]+$/;

export const WEBSUB_CONFIG = {
  enabled: WEBSUB_ENABLED,
  hubSecret: WEBSUB_HUB_SECRET,
  replayMaxAgeMs: WEBSUB_REPLAY_MAX_AGE_MS,
  topicUrlPattern: WEBSUB_TOPIC_URL_PATTERN,
  allowInsecureSignatureBypass:
    process.env.NODE_ENV !== "production" && WEBSUB_HUB_SECRET.length === 0,
} as const;

export function isWebsubEnabled(): boolean {
  return WEBSUB_CONFIG.enabled;
}
