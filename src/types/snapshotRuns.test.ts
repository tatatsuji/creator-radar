import { describe, expect, it } from "vitest";

import { inferSnapshotRunTypeFromLegacySignals } from "@/types/snapshotRuns";

describe("snapshot run type inference", () => {
  it("prefers explicit run_type", () => {
    expect(
      inferSnapshotRunTypeFromLegacySignals({
        runType: "measurement",
        channelsTotal: 10,
      }),
    ).toBe("measurement");
  });

  it("falls back to measurement JSON marker", () => {
    expect(
      inferSnapshotRunTypeFromLegacySignals({
        errorSummary: '{"type":"measurement","phase":"running"}',
      }),
    ).toBe("measurement");
  });

  it("falls back to legacy channels_total signal", () => {
    expect(
      inferSnapshotRunTypeFromLegacySignals({
        channelsTotal: 3,
      }),
    ).toBe("legacy_snapshot");
  });

  it("returns null when ambiguous", () => {
    expect(
      inferSnapshotRunTypeFromLegacySignals({
        channelsTotal: 0,
        errorSummary: null,
        status: "success",
      }),
    ).toBeNull();
  });
});
