export const CONTENT_FORMAT_FILTERS = [
  { id: "all", label: "すべて" },
  { id: "short", label: "Shorts" },
  { id: "live", label: "ライブ" },
  { id: "regular", label: "通常動画" },
] as const;

export type ContentFormatFilter = (typeof CONTENT_FORMAT_FILTERS)[number]["id"];

export function parseContentFormatFilter(value?: string | null): ContentFormatFilter {
  if (value === "short" || value === "live" || value === "regular") {
    return value;
  }
  return "all";
}

export function matchesContentFormatFilter(
  contentKind: "regular" | "short" | "live" | "unknown" | undefined,
  filter: ContentFormatFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (!contentKind || contentKind === "unknown") {
    return filter === "regular";
  }
  return contentKind === filter;
}
