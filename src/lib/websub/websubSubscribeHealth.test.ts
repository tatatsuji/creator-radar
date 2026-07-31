import { describe, expect, it } from "vitest";

import { computeWebsubSubscriptionHealth } from "@/lib/websub/websubSubscribeHealth";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const LEASE_BUFFER_MS = 48 * HOUR_MS;
const VERIFY_STALE_MS = 7 * DAY_MS;
const NOW = new Date("2026-07-31T12:00:00.000Z");

describe("computeWebsubSubscriptionHealth", () => {
  it("returns unhealthy for pending and pending_verify", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "pending",
        leaseExpiresAt: null,
        lastVerifiedAt: null,
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("unhealthy");

    expect(
      computeWebsubSubscriptionHealth({
        status: "pending_verify",
        leaseExpiresAt: new Date(NOW.getTime() + 5 * DAY_MS).toISOString(),
        lastVerifiedAt: NOW.toISOString(),
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("unhealthy");
  });

  it("returns degraded for renew_failed", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "renew_failed",
        leaseExpiresAt: new Date(NOW.getTime() + 5 * DAY_MS).toISOString(),
        lastVerifiedAt: NOW.toISOString(),
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("degraded");
  });

  it("returns unhealthy for expired and dead statuses", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "expired",
        leaseExpiresAt: null,
        lastVerifiedAt: null,
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("unhealthy");

    expect(
      computeWebsubSubscriptionHealth({
        status: "dead",
        leaseExpiresAt: null,
        lastVerifiedAt: null,
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("unhealthy");
  });

  it("returns unhealthy when active lease is expired", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "active",
        leaseExpiresAt: new Date(NOW.getTime() - HOUR_MS).toISOString(),
        lastVerifiedAt: NOW.toISOString(),
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("unhealthy");
  });

  it("returns degraded when active lease is inside the buffer window", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "active",
        leaseExpiresAt: new Date(NOW.getTime() + 24 * HOUR_MS).toISOString(),
        lastVerifiedAt: NOW.toISOString(),
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("degraded");
  });

  it("returns degraded when verification is stale", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "active",
        leaseExpiresAt: new Date(NOW.getTime() + 10 * DAY_MS).toISOString(),
        lastVerifiedAt: new Date(NOW.getTime() - 8 * DAY_MS).toISOString(),
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("degraded");
  });

  it("returns healthy for active subscriptions with fresh lease and verification", () => {
    expect(
      computeWebsubSubscriptionHealth({
        status: "active",
        leaseExpiresAt: new Date(NOW.getTime() + 10 * DAY_MS).toISOString(),
        lastVerifiedAt: new Date(NOW.getTime() - DAY_MS).toISOString(),
        now: NOW,
        leaseBufferMs: LEASE_BUFFER_MS,
        verifyStaleWindowMs: VERIFY_STALE_MS,
      }),
    ).toBe("healthy");
  });
});
