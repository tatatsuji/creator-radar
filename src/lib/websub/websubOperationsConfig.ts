import { isWebsubEnabled, WEBSUB_CONFIG } from "@/lib/websub/websubConfig";

function readNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Step 6B canary rollout limit.
 * 0 = no channel cap (full watchlist when WEBSUB_ENABLED=true).
 * Set to 10 / 30 / 100 during staged canary expansion.
 */
export const WEBSUB_CANARY_MAX_CHANNELS = readNonNegativeInt(
  process.env.WEBSUB_CANARY_MAX_CHANNELS,
  0,
);

export const WEBSUB_CRON_JOBS = [
  "websub-subscribe-new",
  "websub-renew-urgent",
  "websub-renew-daily",
  "websub-reconcile",
  "websub-process-notifications",
] as const;

export type WebsubCronJob = (typeof WEBSUB_CRON_JOBS)[number];

/** GitHub Actions cron expressions — design §12. */
export const WEBSUB_CRON_SCHEDULES: Record<WebsubCronJob, string> = {
  "websub-subscribe-new": "0 2 * * *",
  "websub-renew-urgent": "0 */6 * * *",
  "websub-renew-daily": "0 3 * * *",
  "websub-reconcile": "0 4 * * *",
  "websub-process-notifications": "*/15 * * * *",
};

export const WEBSUB_CRON_NPM_SCRIPTS: Record<WebsubCronJob, string> = {
  "websub-subscribe-new": "cron:websub-subscribe-new",
  "websub-renew-urgent": "cron:websub-renew-urgent",
  "websub-renew-daily": "cron:websub-renew-daily",
  "websub-reconcile": "cron:websub-reconcile",
  "websub-process-notifications": "cron:websub-process-notifications",
};

export const WEBSUB_ENVIRONMENT_VARIABLES = [
  {
    name: "WEBSUB_ENABLED",
    required: false,
    defaultValue: "false",
    description: "Master feature flag. Keep false until canary (Step 6B).",
  },
  {
    name: "WEBSUB_HUB_SECRET",
    required: true,
    whenEnabled: true,
    description: "Hub.shared secret for POST signature verification and subscribe POST.",
  },
  {
    name: "WEBSUB_APP_DOMAIN",
    required: true,
    whenEnabled: true,
    description: "Public app domain for hub.callback (without protocol).",
  },
  {
    name: "WEBSUB_CANARY_MAX_CHANNELS",
    required: false,
    defaultValue: "0",
    description: "Canary channel cap (0 = unlimited). Use 10 → 30 → 100 → 0.",
  },
  {
    name: "WEBSUB_HUB_URL",
    required: false,
    defaultValue: "https://pubsubhubbub.appspot.com/subscribe",
    description: "PubSubHubbub hub endpoint.",
  },
  {
    name: "WEBSUB_SAFETY_POLL_INTERVAL_HOURS",
    required: false,
    defaultValue: "24",
    description: "Safety poll interval for healthy subscriptions.",
  },
] as const;

export interface WebsubOperationsEnvironmentStatus {
  enabled: boolean;
  canaryMaxChannels: number;
  appDomainConfigured: boolean;
  hubSecretConfigured: boolean;
  readyForCanary: boolean;
  missingWhenEnabled: string[];
}

export function getWebsubOperationsEnvironmentStatus(): WebsubOperationsEnvironmentStatus {
  const enabled = isWebsubEnabled();
  const appDomainConfigured = WEBSUB_CONFIG.appDomain.length > 0;
  const hubSecretConfigured = WEBSUB_CONFIG.hubSecret.length > 0;
  const missingWhenEnabled: string[] = [];

  if (enabled && !appDomainConfigured) {
    missingWhenEnabled.push("WEBSUB_APP_DOMAIN");
  }
  if (enabled && !hubSecretConfigured) {
    missingWhenEnabled.push("WEBSUB_HUB_SECRET");
  }

  return {
    enabled,
    canaryMaxChannels: WEBSUB_CANARY_MAX_CHANNELS,
    appDomainConfigured,
    hubSecretConfigured,
    readyForCanary: appDomainConfigured && hubSecretConfigured,
    missingWhenEnabled,
  };
}
