import { WEBSUB_CONFIG } from "@/lib/websub/websubConfig";
import type {
  WebsubSubscriptionHealth,
  WebsubSubscriptionStatus,
} from "@/types/observability";

export interface WebsubSubscriptionHealthInput {
  status: WebsubSubscriptionStatus | string;
  leaseExpiresAt: string | null;
  lastVerifiedAt: string | null;
  now?: Date;
  leaseBufferMs?: number;
  verifyStaleWindowMs?: number;
}

export function computeWebsubSubscriptionHealth(
  input: WebsubSubscriptionHealthInput,
): WebsubSubscriptionHealth {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const leaseBufferMs =
    input.leaseBufferMs ?? WEBSUB_CONFIG.leaseBufferMs;
  const verifyStaleWindowMs =
    input.verifyStaleWindowMs ?? WEBSUB_CONFIG.verifyStaleWindowMs;

  const status = input.status as WebsubSubscriptionStatus;

  if (
    status === "expired" ||
    status === "dead" ||
    status === "unsubscribed" ||
    status === "orphaned"
  ) {
    return "unhealthy";
  }

  if (status === "renew_failed") {
    return "degraded";
  }

  if (status === "pending" || status === "pending_verify") {
    return "unhealthy";
  }

  if (status !== "active") {
    return "unhealthy";
  }

  if (!input.leaseExpiresAt) {
    return "unhealthy";
  }

  const leaseExpiresAtMs = new Date(input.leaseExpiresAt).getTime();
  if (Number.isNaN(leaseExpiresAtMs) || leaseExpiresAtMs <= nowMs) {
    return "unhealthy";
  }

  if (leaseExpiresAtMs <= nowMs + leaseBufferMs) {
    return "degraded";
  }

  if (!input.lastVerifiedAt) {
    return "degraded";
  }

  const lastVerifiedAtMs = new Date(input.lastVerifiedAt).getTime();
  if (
    Number.isNaN(lastVerifiedAtMs) ||
    lastVerifiedAtMs <= nowMs - verifyStaleWindowMs
  ) {
    return "degraded";
  }

  return "healthy";
}
