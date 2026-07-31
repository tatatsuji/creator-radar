import { estimateDiscoveryQuotaPerRun } from "@/lib/discovery/quotaBudget";
import { getDueVideos } from "@/lib/measurement/scheduleRepository";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import { QUOTA_UNITS } from "@/lib/observability/quotaEstimates";
import { countDueWatchlistChannels } from "@/lib/watchlist/repository";

export function estimateWatchlistDiscoveryQuotaUnits(
  dueChannelCount: number,
): number {
  return dueChannelCount * QUOTA_UNITS.discoveryPerChannelWithVideos;
}

export function estimateMeasurementRunQuotaUnits(dueVideoCount: number): number {
  if (dueVideoCount <= 0) {
    return 0;
  }

  const videoBatches = Math.ceil(
    dueVideoCount / OBSERVABILITY_CONFIG.batchSize.measurement,
  );
  return videoBatches * QUOTA_UNITS.videosListPerBatch;
}

export function estimateCandidateDiscoveryQuotaUnits(runIndex = 0): number {
  return estimateDiscoveryQuotaPerRun(runIndex).totalPerRun;
}

export async function estimateWatchlistDiscoveryQuotaForCron(): Promise<number> {
  const dueChannelCount = await countDueWatchlistChannels();
  return estimateWatchlistDiscoveryQuotaUnits(
    Math.min(dueChannelCount, OBSERVABILITY_CONFIG.batchSize.watchlistCheck),
  );
}

export async function estimateMeasurementQuotaForCron(): Promise<number> {
  const dueVideos = await getDueVideos(
    OBSERVABILITY_CONFIG.batchSize.measurement,
  );
  return estimateMeasurementRunQuotaUnits(dueVideos.length);
}

export async function estimateCandidateDiscoveryQuotaForCron(
  runIndex = 0,
): Promise<number> {
  return estimateCandidateDiscoveryQuotaUnits(runIndex);
}
