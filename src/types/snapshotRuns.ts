export const SNAPSHOT_RUN_TYPES = ["legacy_snapshot", "measurement"] as const;

export type SnapshotRunType = (typeof SNAPSHOT_RUN_TYPES)[number];

export function isSnapshotRunType(value: string | null | undefined): value is SnapshotRunType {
  return value === "legacy_snapshot" || value === "measurement";
}

export function inferSnapshotRunTypeFromLegacySignals(input: {
  runType?: string | null;
  channelsTotal?: number | null;
  errorSummary?: string | null;
  status?: string | null;
}): SnapshotRunType | null {
  if (isSnapshotRunType(input.runType ?? null)) {
    return input.runType as SnapshotRunType;
  }

  if (input.errorSummary?.includes('"type":"measurement"')) {
    return "measurement";
  }

  if ((input.channelsTotal ?? 0) > 0) {
    return "legacy_snapshot";
  }

  if (input.status === "running" && !input.errorSummary) {
    return "legacy_snapshot";
  }

  return null;
}
