import type { HomeUrlState } from "@/lib/home/urlState";
import {
  getRankingViewDefinition,
  type RankingViewDefinition,
  type RankingViewId,
} from "@/lib/ranking/rankingMeta";

export function resolveActiveViewFromState(
  homeUrlState: HomeUrlState,
): RankingViewId {
  if (homeUrlState.format === "short") {
    return "shorts";
  }
  if (homeUrlState.format === "live") {
    return "live";
  }
  if (homeUrlState.genre !== "all") {
    return "genre";
  }
  return homeUrlState.ranking;
}

export function getActiveRankingView(
  homeUrlState: HomeUrlState,
): RankingViewDefinition {
  return getRankingViewDefinition(resolveActiveViewFromState(homeUrlState));
}

export { getRankingViewDefinition, type RankingViewId, type RankingViewDefinition };
