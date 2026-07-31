import type { WatchTier } from "@/types/observability";

export const WATCH_TIER_DESCENDING_ORDER = [
  "hot",
  "active",
  "normal",
  "cold",
  "archive",
] as const satisfies readonly WatchTier[];

export type DemotableWatchTier = Exclude<WatchTier, "archive">;
export type PromotableWatchTier = Exclude<WatchTier, "hot" | "archive">;

export function getHigherWatchTier(tier: WatchTier): WatchTier | null {
  const index = WATCH_TIER_DESCENDING_ORDER.indexOf(tier);
  if (index <= 0) {
    return null;
  }
  return WATCH_TIER_DESCENDING_ORDER[index - 1] ?? null;
}

export function getLowerWatchTier(tier: WatchTier): WatchTier | null {
  const index = WATCH_TIER_DESCENDING_ORDER.indexOf(tier);
  if (index < 0 || index >= WATCH_TIER_DESCENDING_ORDER.length - 1) {
    return null;
  }
  return WATCH_TIER_DESCENDING_ORDER[index + 1] ?? null;
}
