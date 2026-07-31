import {
  countCandidateDiscoveries,
  countDiscoveriesBySourceType,
} from "@/lib/discovery/repository";
import {
  getLatestDiscoveryRun,
} from "@/lib/discovery/runsRepository";
import { getMeasurementScheduleSummary } from "@/lib/measurement/scheduleRepository";
import { buildPipelineHealthFromRuns } from "@/lib/observability/health";
import {
  countDistinctVideosWithSnapshots,
  countVideoSnapshots,
  countVideoSnapshotsSince,
  countVideosWithMultipleSnapshots,
  getLatestMeasurementRun,
  getLatestVideoSnapshotCapturedAt,
} from "@/lib/snapshots/repository";
import {
  countDueWatchlistChannels,
  countWatchlistChannels,
} from "@/lib/watchlist/repository";
import { loadWebsubObservabilityStatus } from "@/lib/observability/websubStatus";
import type { WebsubObservabilityStatus } from "@/lib/observability/websubStatus";
import type { DiscoveryRunRow, SnapshotRunRow } from "@/types/database";
import type { PipelineHealth } from "@/lib/observability/health";

export interface ObservabilityStatus {
  watchlistCount: number;
  candidateCount: number;
  discoveryDueCount: number;
  channelsCheckedThisRun: number;
  videosDiscoveredThisRun: number;
  discoverySourceCounts: Record<string, number>;
  lastDiscoveryRun: DiscoveryRunRow | null;
  measurement: {
    scheduleTotal: number;
    scheduleByTier: Record<string, number>;
    scheduleByStatus: Record<string, number>;
    dueNow: number;
    activeLocks: number;
    latestLastMeasuredAt: string | null;
    videoSnapshotsCount: number;
    snapshotsLast24Hours: number;
    videosWithSnapshots: number;
    videosWithMultipleSnapshots: number;
    latestSnapshotCapturedAt: string | null;
    lastRun: {
      runId: string;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      metadata: Record<string, unknown> | null;
    } | null;
  };
  health: PipelineHealth;
  websub: WebsubObservabilityStatus | null;
  checkedAt: string;
}

function parseMeasurementRunMetadata(
  errorSummary: string | null,
): Record<string, unknown> | null {
  if (!errorSummary) {
    return null;
  }

  try {
    const parsed = JSON.parse(errorSummary) as Record<string, unknown>;
    return parsed.type === "measurement" ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadObservabilityStatus(): Promise<ObservabilityStatus> {
  const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    watchlistCount,
    candidateCount,
    discoveryDueCount,
    lastDiscoveryRun,
    measurementSummary,
    videoSnapshotsCount,
    snapshotsLast24Hours,
    videosWithSnapshots,
    videosWithMultipleSnapshots,
    latestSnapshotCapturedAt,
    lastMeasurementRun,
  ] = await Promise.all([
    countWatchlistChannels(),
    countCandidateDiscoveries(),
    countDueWatchlistChannels(),
    getLatestDiscoveryRun(),
    getMeasurementScheduleSummary(),
    countVideoSnapshots(),
    countVideoSnapshotsSince(since24Hours),
    countDistinctVideosWithSnapshots(),
    countVideosWithMultipleSnapshots(),
    getLatestVideoSnapshotCapturedAt(),
    getLatestMeasurementRun(),
  ]);

  const health = buildPipelineHealthFromRuns({
    latestDiscoveryRun: lastDiscoveryRun,
    latestMeasurementRun: lastMeasurementRun,
    latestSnapshotCapturedAt,
    dueMeasurementCount: measurementSummary.dueNow,
    activeLockCount: measurementSummary.activeLocks,
  });

  const discoverySourceCounts = await countDiscoveriesBySourceType();

  let websub: WebsubObservabilityStatus | null = null;
  try {
    websub = await loadWebsubObservabilityStatus();
  } catch {
    websub = null;
  }

  return {
    watchlistCount,
    candidateCount,
    discoveryDueCount,
    channelsCheckedThisRun: lastDiscoveryRun?.items_processed ?? 0,
    videosDiscoveredThisRun: lastDiscoveryRun?.items_discovered ?? 0,
    discoverySourceCounts,
    lastDiscoveryRun,
    measurement: {
      scheduleTotal: measurementSummary.total,
      scheduleByTier: measurementSummary.byTier,
      scheduleByStatus: measurementSummary.byStatus,
      dueNow: measurementSummary.dueNow,
      activeLocks: measurementSummary.activeLocks,
      latestLastMeasuredAt: measurementSummary.latestLastMeasuredAt,
      videoSnapshotsCount,
      snapshotsLast24Hours,
      videosWithSnapshots,
      videosWithMultipleSnapshots,
      latestSnapshotCapturedAt,
      lastRun: formatMeasurementRun(lastMeasurementRun),
    },
    health,
    websub,
    checkedAt: new Date().toISOString(),
  };
}

function formatMeasurementRun(
  run: SnapshotRunRow | null,
): ObservabilityStatus["measurement"]["lastRun"] {
  if (!run) {
    return null;
  }

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    metadata: parseMeasurementRunMetadata(run.error_summary),
  };
}
