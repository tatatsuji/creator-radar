import { describe, expect, it } from "vitest";

import {
  buildPipelineHealthFromRuns,
  evaluateDiscoveryHealth,
  evaluateMeasurementHealth,
} from "@/lib/observability/health";
import type { DiscoveryRunRow, SnapshotRunRow } from "@/types/database";

function makeDiscoveryRun(
  overrides: Partial<DiscoveryRunRow>,
): DiscoveryRunRow {
  return {
    id: "discovery-run-1",
    run_type: "watchlist_check",
    status: "success",
    algorithm_version: "v1",
    started_at: "2026-07-26T00:00:00.000Z",
    finished_at: "2026-07-26T00:05:00.000Z",
    items_processed: 3,
    items_discovered: 5,
    items_failed: 0,
    youtube_quota_estimate: 9,
    cursor: null,
    error_summary: null,
    metadata: null,
    ...overrides,
  };
}

function makeMeasurementRun(
  overrides: Partial<SnapshotRunRow>,
): SnapshotRunRow {
  return {
    id: "measurement-run-1",
    started_at: "2026-07-26T00:00:00.000Z",
    finished_at: "2026-07-26T00:01:00.000Z",
    status: "success",
    videos_total: 15,
    videos_success: 15,
    videos_failed: 0,
    videos_skipped: 0,
    channels_total: 0,
    channels_success: 0,
    channels_skipped: 0,
    youtube_quota_used: 1,
    run_type: "measurement",
    error_summary: '{"type":"measurement"}',
    ...overrides,
  };
}

describe("pipeline health", () => {
  const nowMs = Date.parse("2026-07-26T06:00:00.000Z");

  it("marks discovery as never_run when no runs exist", () => {
    expect(evaluateDiscoveryHealth({ latestRun: null, nowMs })).toBe("never_run");
  });

  it("marks discovery as healthy within 12 hours", () => {
    expect(
      evaluateDiscoveryHealth({
        latestRun: makeDiscoveryRun({
          finished_at: "2026-07-26T05:00:00.000Z",
        }),
        nowMs,
      }),
    ).toBe("healthy");
  });

  it("marks discovery as stale after 12 hours", () => {
    expect(
      evaluateDiscoveryHealth({
        latestRun: makeDiscoveryRun({
          finished_at: "2026-07-25T17:00:00.000Z",
        }),
        nowMs,
      }),
    ).toBe("stale");
  });

  it("marks discovery as error when latest run failed", () => {
    expect(
      evaluateDiscoveryHealth({
        latestRun: makeDiscoveryRun({
          status: "failed",
          finished_at: "2026-07-26T05:00:00.000Z",
        }),
        nowMs,
      }),
    ).toBe("error");
  });

  it("marks measurement as healthy within 2 hours", () => {
    expect(
      evaluateMeasurementHealth({
        latestRun: makeMeasurementRun({
          finished_at: "2026-07-26T05:30:00.000Z",
        }),
        latestSnapshotCapturedAt: "2026-07-26T05:30:00.000Z",
        dueMeasurementCount: 0,
        activeLockCount: 0,
        nowMs,
      }),
    ).toBe("healthy");
  });

  it("marks measurement as stale after 2 hours", () => {
    expect(
      evaluateMeasurementHealth({
        latestRun: makeMeasurementRun({
          finished_at: "2026-07-26T03:00:00.000Z",
        }),
        latestSnapshotCapturedAt: "2026-07-26T03:00:00.000Z",
        dueMeasurementCount: 0,
        activeLockCount: 0,
        nowMs,
      }),
    ).toBe("stale");
  });

  it("builds combined health payload", () => {
    const health = buildPipelineHealthFromRuns({
      latestDiscoveryRun: makeDiscoveryRun({
        finished_at: "2026-07-26T05:00:00.000Z",
      }),
      latestMeasurementRun: makeMeasurementRun({
        finished_at: "2026-07-26T05:30:00.000Z",
      }),
      latestSnapshotCapturedAt: "2026-07-26T05:30:00.000Z",
      dueMeasurementCount: 0,
      activeLockCount: 0,
      nowMs,
    });

    expect(health.discovery).toBe("healthy");
    expect(health.measurement).toBe("healthy");
    expect(health.snapshotFreshnessMinutes).toBe(30);
    expect(health.dueMeasurementCount).toBe(0);
  });
});
