import { describe, expect, it } from "vitest";

import {
  getWatchlistPollNextCheckAt,
  resolveWatchlistPollMode,
} from "@/lib/websub/watchlistPollPolicy";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-31T12:00:00.000Z");

describe("resolveWatchlistPollMode", () => {
  it("uses normal poll when WebSub is disabled", () => {
    expect(
      resolveWatchlistPollMode({
        websubEnabled: false,
        subscriptionHealth: "healthy",
        lastCheckedAt: null,
        now: NOW,
      }),
    ).toEqual({ mode: "normal", reason: "websub_disabled" });
  });

  it("uses normal poll when WebSub is unregistered", () => {
    expect(
      resolveWatchlistPollMode({
        websubEnabled: true,
        subscriptionHealth: null,
        lastCheckedAt: null,
        now: NOW,
      }),
    ).toEqual({ mode: "normal", reason: "websub_unregistered" });
  });

  it("skips normal poll for healthy subscriptions checked recently", () => {
    expect(
      resolveWatchlistPollMode({
        websubEnabled: true,
        subscriptionHealth: "healthy",
        lastCheckedAt: new Date(NOW.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        now: NOW,
        safetyPollIntervalMs: DAY_MS,
      }),
    ).toEqual({ mode: "skip", reason: "websub_healthy_skip" });
  });

  it("uses safety poll for healthy subscriptions after 24 hours", () => {
    expect(
      resolveWatchlistPollMode({
        websubEnabled: true,
        subscriptionHealth: "healthy",
        lastCheckedAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString(),
        now: NOW,
        safetyPollIntervalMs: DAY_MS,
      }),
    ).toEqual({ mode: "safety", reason: "websub_healthy_safety_poll_due" });
  });

  it("uses normal poll for degraded subscriptions", () => {
    expect(
      resolveWatchlistPollMode({
        websubEnabled: true,
        subscriptionHealth: "degraded",
        lastCheckedAt: NOW.toISOString(),
        now: NOW,
      }),
    ).toEqual({ mode: "normal", reason: "websub_health_degraded" });
  });

  it("uses normal poll for unhealthy and expired subscriptions", () => {
    expect(
      resolveWatchlistPollMode({
        websubEnabled: true,
        subscriptionHealth: "unhealthy",
        lastCheckedAt: NOW.toISOString(),
        now: NOW,
      }),
    ).toEqual({ mode: "normal", reason: "websub_health_unhealthy" });
  });
});

describe("getWatchlistPollNextCheckAt", () => {
  it("schedules the next safety poll 24 hours after the last check", () => {
    const lastCheckedAt = new Date(NOW.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const nextCheckAt = getWatchlistPollNextCheckAt({
      mode: "skip",
      lastCheckedAt,
      now: NOW,
      safetyPollIntervalMs: DAY_MS,
    });

    expect(nextCheckAt.toISOString()).toBe(
      new Date(new Date(lastCheckedAt).getTime() + DAY_MS).toISOString(),
    );
  });
});
