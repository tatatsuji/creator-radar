import type { HomeUrlState } from "@/lib/home/urlState";
import {
  getContentFilterDefinition,
  type ContentFilterDefinition,
  type ContentFilterViewId,
} from "@/lib/ranking/rankingMeta";

export function resolveActiveContentFilter(
  homeUrlState: HomeUrlState,
): ContentFilterViewId | null {
  if (homeUrlState.genre === "shorts") {
    return "shorts";
  }
  if (homeUrlState.format === "short") {
    return "shorts";
  }
  if (homeUrlState.format === "live") {
    return "live";
  }
  if (homeUrlState.genre !== "all") {
    return "genre";
  }
  return null;
}

export function getActiveContentFilter(
  homeUrlState: HomeUrlState,
): ContentFilterDefinition | null {
  const filterId = resolveActiveContentFilter(homeUrlState);
  return filterId ? getContentFilterDefinition(filterId) : null;
}

export {
  getContentFilterDefinition,
  type ContentFilterViewId,
  type ContentFilterDefinition,
};
