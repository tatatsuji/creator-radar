/**
 * YouTube quota estimates for observability reporting.
 * search.list is not used in Discovery/Measurement pipelines.
 */

export const YOUTUBE_DAILY_QUOTA_UNITS = 10_000;

export const QUOTA_UNITS = {
  videosListPerBatch: 1,
  channelsListPerBatch: 1,
  playlistItemsList: 1,
  searchList: 100,
  discoveryPerChannelWithVideos: 3,
  discoveryPerChannelWithoutVideos: 2,
  legacyRankingFetch: 12,
} as const;

export interface QuotaScenarioInput {
  label: string;
  watchlistChannels: number;
  measuredVideos: number;
  discoveryRunsPerDay: number;
  measurementRunsPerDay: number;
  legacySnapshotRunsPerDay?: number;
}

export interface QuotaScenarioEstimate {
  label: string;
  discoveryUnitsPerDay: number;
  measurementUnitsPerDay: number;
  legacySnapshotUnitsPerDay: number;
  totalUnitsPerDay: number;
  withinDailyQuota: boolean;
}

function discoveryUnitsPerRun(channelCount: number): number {
  return channelCount * QUOTA_UNITS.discoveryPerChannelWithVideos;
}

function measurementUnitsPerRun(videoCount: number): number {
  return Math.ceil(videoCount / 50) * QUOTA_UNITS.videosListPerBatch;
}

function legacySnapshotUnitsPerRun(videoCount: number, channelCount: number): number {
  return (
    QUOTA_UNITS.legacyRankingFetch +
    measurementUnitsPerRun(videoCount) +
    Math.ceil(channelCount / 50) * QUOTA_UNITS.channelsListPerBatch
  );
}

export function estimateQuotaScenario(
  input: QuotaScenarioInput,
): QuotaScenarioEstimate {
  const discoveryUnitsPerDay =
    input.discoveryRunsPerDay * discoveryUnitsPerRun(input.watchlistChannels);
  const measurementUnitsPerDay =
    input.measurementRunsPerDay *
    measurementUnitsPerRun(input.measuredVideos);
  const legacySnapshotUnitsPerDay =
    (input.legacySnapshotRunsPerDay ?? 0) *
    legacySnapshotUnitsPerRun(input.measuredVideos, input.watchlistChannels);

  const totalUnitsPerDay =
    discoveryUnitsPerDay + measurementUnitsPerDay + legacySnapshotUnitsPerDay;

  return {
    label: input.label,
    discoveryUnitsPerDay,
    measurementUnitsPerDay,
    legacySnapshotUnitsPerDay,
    totalUnitsPerDay,
    withinDailyQuota: totalUnitsPerDay <= YOUTUBE_DAILY_QUOTA_UNITS,
  };
}

export function estimateRankingDiscoveryQuotaUnits(input: {
  videoCount: number;
  channelCount: number;
  searchCalls: number;
}): number {
  return (
    input.searchCalls * QUOTA_UNITS.searchList +
    Math.ceil(input.videoCount / 50) * QUOTA_UNITS.videosListPerBatch +
    Math.ceil(input.channelCount / 50) * QUOTA_UNITS.channelsListPerBatch
  );
}

export function buildDefaultQuotaScenarios(): QuotaScenarioEstimate[] {
  return [
    estimateQuotaScenario({
      label: "Current dev (3 channels, 15 videos)",
      watchlistChannels: 3,
      measuredVideos: 15,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
      legacySnapshotRunsPerDay: 24,
    }),
    estimateQuotaScenario({
      label: "100 channels, 500 measured videos",
      watchlistChannels: 100,
      measuredVideos: 500,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
    }),
    estimateQuotaScenario({
      label: "500 channels, 2,500 measured videos",
      watchlistChannels: 500,
      measuredVideos: 2_500,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
    }),
    estimateQuotaScenario({
      label: "1,000 channels, 5,000 measured videos",
      watchlistChannels: 1_000,
      measuredVideos: 5_000,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
    }),
    estimateQuotaScenario({
      label: "1,000 measured videos (measurement only)",
      watchlistChannels: 100,
      measuredVideos: 1_000,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
    }),
    estimateQuotaScenario({
      label: "10,000 measured videos (measurement only)",
      watchlistChannels: 500,
      measuredVideos: 10_000,
      discoveryRunsPerDay: 4,
      measurementRunsPerDay: 24,
    }),
  ];
}
