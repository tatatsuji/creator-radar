export type DeltaWindow = "1h" | "3h" | "24h" | "7d" | "30d";

export type HistoryRange = "24h" | "7d" | "30d";

export interface DeltaWindowConfig {
  id: DeltaWindow;
  label: string;
  hours: number;
}

export const DELTA_WINDOWS: DeltaWindowConfig[] = [
  { id: "1h", label: "1時間", hours: 1 },
  { id: "3h", label: "3時間", hours: 3 },
  { id: "24h", label: "24時間", hours: 24 },
  { id: "7d", label: "7日", hours: 168 },
  { id: "30d", label: "30日", hours: 720 },
];

export const HISTORY_RANGES: Array<{ id: HistoryRange; label: string; hours: number }> =
  [
    { id: "24h", label: "24時間", hours: 24 },
    { id: "7d", label: "7日", hours: 168 },
    { id: "30d", label: "30日", hours: 720 },
  ];

const DELTA_WINDOW_MAP = new Map(DELTA_WINDOWS.map((window) => [window.id, window]));
const HISTORY_RANGE_MAP = new Map(HISTORY_RANGES.map((range) => [range.id, range]));

export function getDeltaWindowHours(window: DeltaWindow): number {
  return DELTA_WINDOW_MAP.get(window)?.hours ?? 24;
}

export function getDeltaWindowLabel(window: DeltaWindow): string {
  return DELTA_WINDOW_MAP.get(window)?.label ?? "24時間";
}

export function getHistoryRangeHours(range: HistoryRange): number {
  return HISTORY_RANGE_MAP.get(range)?.hours ?? 24;
}

export function getHistoryRangeLabel(range: HistoryRange): string {
  return HISTORY_RANGE_MAP.get(range)?.label ?? "24時間";
}

export function parseHistoryRange(value?: string | null): HistoryRange {
  if (value && HISTORY_RANGE_MAP.has(value as HistoryRange)) {
    return value as HistoryRange;
  }

  return "24h";
}
