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
  workerBatchSize: readPositiveInt(process.env.WEBSUB_WORKER_BATCH_SIZE, 50),
  workerMaxBatchesPerRun: readPositiveInt(
    process.env.WEBSUB_WORKER_MAX_BATCHES_PER_RUN,
    4,
  ),
  workerProcessingLeaseSeconds: readPositiveInt(
    process.env.WEBSUB_WORKER_PROCESSING_LEASE_SECONDS,
    600,
  ),
  leaseBufferHours: readPositiveInt(process.env.WEBSUB_LEASE_BUFFER_HOURS, 48),
  verifyStaleDays: readPositiveInt(process.env.WEBSUB_VERIFY_STALE_DAYS, 7),
  leaseRequestSeconds: readPositiveInt(
    process.env.WEBSUB_LEASE_REQUEST_SECONDS,
    604800,
  ),
  pendingVerifyStaleHours: readPositiveInt(
    process.env.WEBSUB_PENDING_VERIFY_STALE_HOURS,
    48,
  ),
  maxSubscribeAttempts: readPositiveInt(
    process.env.WEBSUB_MAX_SUBSCRIBE_ATTEMPTS,
    5,
  ),
  subscribeBatchLimit: readPositiveInt(
    process.env.WEBSUB_SUBSCRIBE_BATCH_LIMIT,
    200,
  ),
  subscribeConcurrency: readPositiveInt(
    process.env.WEBSUB_SUBSCRIBE_CONCURRENCY,
    10,
  ),
  urgentRenewWithinHours: readPositiveInt(
    process.env.WEBSUB_URGENT_RENEW_WITHIN_HOURS,
    72,
  ),
  dailyRenewWithinDays: readPositiveInt(
    process.env.WEBSUB_DAILY_RENEW_WITHIN_DAYS,
    7,
  ),
  hubUrl:
    process.env.WEBSUB_HUB_URL?.trim() ??
    "https://pubsubhubbub.appspot.com/subscribe",
  appDomain:
    process.env.WEBSUB_APP_DOMAIN?.trim() ??
    process.env.VERCEL_URL?.trim() ??
    "",
  get leaseBufferMs(): number {
    return this.leaseBufferHours * 60 * 60 * 1000;
  },
  get verifyStaleWindowMs(): number {
    return this.verifyStaleDays * 24 * 60 * 60 * 1000;
  },
  get pendingVerifyStaleMs(): number {
    return this.pendingVerifyStaleHours * 60 * 60 * 1000;
  },
  get urgentRenewWithinMs(): number {
    return this.urgentRenewWithinHours * 60 * 60 * 1000;
  },
  get dailyRenewWithinMs(): number {
    return this.dailyRenewWithinDays * 24 * 60 * 60 * 1000;
  },
} as const;

export function getWebsubCallbackUrl(): string {
  const domain = WEBSUB_CONFIG.appDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) {
    throw new Error("WEBSUB_APP_DOMAIN (or VERCEL_URL) is required for Subscribe Manager");
  }

  return `https://${domain}/api/websub/callback`;
}

export function isWebsubEnabled(): boolean {
  return WEBSUB_CONFIG.enabled;
}
