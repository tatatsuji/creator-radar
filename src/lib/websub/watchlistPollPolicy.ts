import { WEBSUB_CONFIG } from "@/lib/websub/websubConfig";
import type { WebsubSubscriptionHealth } from "@/types/observability";

export type WatchlistPollMode = "normal" | "safety" | "skip";

export interface WatchlistPollDecision {
  mode: WatchlistPollMode;
  reason: string;
}

export interface ResolveWatchlistPollModeInput {
  websubEnabled: boolean;
  subscriptionHealth: WebsubSubscriptionHealth | string | null;
  lastCheckedAt: string | null;
  now?: Date;
  safetyPollIntervalMs?: number;
}

export function resolveWatchlistPollMode(
  input: ResolveWatchlistPollModeInput,
): WatchlistPollDecision {
  if (!input.websubEnabled) {
    return { mode: "normal", reason: "websub_disabled" };
  }

  if (!input.subscriptionHealth) {
    return { mode: "normal", reason: "websub_unregistered" };
  }

  if (input.subscriptionHealth !== "healthy") {
    return {
      mode: "normal",
      reason: `websub_health_${input.subscriptionHealth}`,
    };
  }

  const now = input.now ?? new Date();
  const safetyPollIntervalMs =
    input.safetyPollIntervalMs ?? WEBSUB_CONFIG.safetyPollIntervalMs;

  if (!input.lastCheckedAt) {
    return { mode: "safety", reason: "websub_healthy_safety_poll_initial" };
  }

  const elapsedMs = now.getTime() - new Date(input.lastCheckedAt).getTime();
  if (elapsedMs >= safetyPollIntervalMs) {
    return { mode: "safety", reason: "websub_healthy_safety_poll_due" };
  }

  return { mode: "skip", reason: "websub_healthy_skip" };
}

export function getWatchlistPollNextCheckAt(input: {
  mode: WatchlistPollMode;
  lastCheckedAt: string | null;
  now?: Date;
  safetyPollIntervalMs?: number;
}): Date {
  const now = input.now ?? new Date();
  const safetyPollIntervalMs =
    input.safetyPollIntervalMs ?? WEBSUB_CONFIG.safetyPollIntervalMs;

  if (input.mode === "skip" && input.lastCheckedAt) {
    const safetyDueAt =
      new Date(input.lastCheckedAt).getTime() + safetyPollIntervalMs;
    return new Date(Math.max(safetyDueAt, now.getTime()));
  }

  return new Date(now.getTime() + safetyPollIntervalMs);
}
