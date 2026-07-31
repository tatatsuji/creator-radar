import type { WatchTier } from "@/types/observability";

export interface WebsubCanaryWatchlistCandidate {
  channelId: string;
  watchTier: WatchTier | string;
}

export interface SelectWebsubCanaryChannelsResult {
  selectedChannelIds: string[];
  eligibleCount: number;
  maxChannels: number;
  skippedByCapCount: number;
}

/** hot → active → normal → cold (design §14 step 8). */
const CANARY_TIER_PRIORITY: Record<string, number> = {
  hot: 0,
  active: 1,
  normal: 2,
  cold: 3,
};

const UNKNOWN_TIER_PRIORITY = 99;

function compareCanaryCandidates(
  left: WebsubCanaryWatchlistCandidate,
  right: WebsubCanaryWatchlistCandidate,
): number {
  const leftPriority =
    CANARY_TIER_PRIORITY[left.watchTier] ?? UNKNOWN_TIER_PRIORITY;
  const rightPriority =
    CANARY_TIER_PRIORITY[right.watchTier] ?? UNKNOWN_TIER_PRIORITY;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.channelId.localeCompare(right.channelId);
}

/**
 * Select watchlist channels for WebSub canary rollout.
 * maxChannels = 0 means no cap (all eligible candidates).
 */
export function selectWebsubCanaryChannels(
  candidates: WebsubCanaryWatchlistCandidate[],
  maxChannels: number,
): SelectWebsubCanaryChannelsResult {
  const eligibleCount = candidates.length;
  const sorted = [...candidates].sort(compareCanaryCandidates);

  if (maxChannels <= 0) {
    return {
      selectedChannelIds: sorted.map((candidate) => candidate.channelId),
      eligibleCount,
      maxChannels: 0,
      skippedByCapCount: 0,
    };
  }

  const selected = sorted.slice(0, maxChannels);

  return {
    selectedChannelIds: selected.map((candidate) => candidate.channelId),
    eligibleCount,
    maxChannels,
    skippedByCapCount: Math.max(0, eligibleCount - selected.length),
  };
}

export function isChannelInWebsubCanarySelection(
  channelId: string,
  selection: SelectWebsubCanaryChannelsResult,
): boolean {
  return selection.selectedChannelIds.includes(channelId);
}
