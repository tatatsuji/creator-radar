import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import type { DiscoveryRunRow, SnapshotRunRow } from "@/types/database";

export type PipelineHealthStatus = "healthy" | "stale" | "error" | "never_run";

export interface PipelineHealth {
  discovery: PipelineHealthStatus;
  measurement: PipelineHealthStatus;
  snapshotFreshnessMinutes: number | null;
  dueMeasurementCount: number;
  activeLockCount: number;
}

export interface EvaluateDiscoveryHealthInput {
  latestRun: DiscoveryRunRow | null;
  nowMs?: number;
}

export interface EvaluateMeasurementHealthInput {
  latestRun: SnapshotRunRow | null;
  latestSnapshotCapturedAt: string | null;
  dueMeasurementCount: number;
  activeLockCount: number;
  nowMs?: number;
}

function minutesSince(isoTimestamp: string | null, nowMs: number): number | null {
  if (!isoTimestamp) {
    return null;
  }

  const elapsedMs = nowMs - new Date(isoTimestamp).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) {
    return null;
  }

  return Math.floor(elapsedMs / (60 * 1000));
}

export function evaluateDiscoveryHealth(
  input: EvaluateDiscoveryHealthInput,
): PipelineHealthStatus {
  const nowMs = input.nowMs ?? Date.now();
  const { latestRun } = input;

  if (!latestRun) {
    return "never_run";
  }

  if (latestRun.status === "failed") {
    return "error";
  }

  if (latestRun.status === "running") {
    const startedMs = new Date(latestRun.started_at).getTime();
    if (
      nowMs - startedMs >
      OBSERVABILITY_CONFIG.health.discoveryRunningWindowMs
    ) {
      return "error";
    }
    return "healthy";
  }

  const finishedAt = latestRun.finished_at ?? latestRun.started_at;
  const ageMs = nowMs - new Date(finishedAt).getTime();

  if (ageMs <= OBSERVABILITY_CONFIG.health.discoveryHealthyWithinMs) {
    return "healthy";
  }

  return "stale";
}

export function evaluateMeasurementHealth(
  input: EvaluateMeasurementHealthInput,
): PipelineHealthStatus {
  const nowMs = input.nowMs ?? Date.now();
  const { latestRun } = input;

  if (!latestRun) {
    return "never_run";
  }

  if (latestRun.status === "failed") {
    return "error";
  }

  if (latestRun.status === "running") {
    const startedMs = new Date(latestRun.started_at).getTime();
    if (
      nowMs - startedMs >
      OBSERVABILITY_CONFIG.health.measurementRunningWindowMs
    ) {
      return "error";
    }
    return "healthy";
  }

  const finishedAt = latestRun.finished_at ?? latestRun.started_at;
  const ageMs = nowMs - new Date(finishedAt).getTime();

  if (ageMs <= OBSERVABILITY_CONFIG.health.measurementHealthyWithinMs) {
    return "healthy";
  }

  return "stale";
}

export function buildPipelineHealthFromRuns(input: {
  latestDiscoveryRun: DiscoveryRunRow | null;
  latestMeasurementRun: SnapshotRunRow | null;
  latestSnapshotCapturedAt: string | null;
  dueMeasurementCount: number;
  activeLockCount: number;
  nowMs?: number;
}): PipelineHealth {
  const nowMs = input.nowMs ?? Date.now();

  return {
    discovery: evaluateDiscoveryHealth({
      latestRun: input.latestDiscoveryRun,
      nowMs,
    }),
    measurement: evaluateMeasurementHealth({
      latestRun: input.latestMeasurementRun,
      latestSnapshotCapturedAt: input.latestSnapshotCapturedAt,
      dueMeasurementCount: input.dueMeasurementCount,
      activeLockCount: input.activeLockCount,
      nowMs,
    }),
    snapshotFreshnessMinutes: minutesSince(input.latestSnapshotCapturedAt, nowMs),
    dueMeasurementCount: input.dueMeasurementCount,
    activeLockCount: input.activeLockCount,
  };
}
