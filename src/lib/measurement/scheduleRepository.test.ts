import { describe, expect, it } from "vitest";

import {
  filterDueMeasurementSchedules,
  isMeasurementLockActive,
  acquireMeasurementLock,
} from "@/lib/measurement/scheduleRepository";
import type { MeasurementScheduleRow } from "@/types/database";

function makeRow(
  overrides: Partial<MeasurementScheduleRow> & Pick<MeasurementScheduleRow, "video_id">,
): MeasurementScheduleRow {
  return {
    measurement_tier: "hot",
    measurement_status: "pending",
    next_measurement_at: null,
    last_measured_at: null,
    failure_count: 0,
    lock_token: null,
    locked_until: null,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("measurement schedule helpers", () => {
  const nowMs = Date.parse("2026-07-24T12:00:00.000Z");

  it("detects active locks", () => {
    expect(isMeasurementLockActive(null, nowMs)).toBe(false);
    expect(isMeasurementLockActive("2026-07-24T13:00:00.000Z", nowMs)).toBe(true);
    expect(isMeasurementLockActive("2026-07-24T11:00:00.000Z", nowMs)).toBe(false);
  });

  it("filters due and unlocked schedules", () => {
    const rows = [
      makeRow({
        video_id: "video-due",
        next_measurement_at: "2026-07-24T11:00:00.000Z",
      }),
      makeRow({
        video_id: "video-locked",
        next_measurement_at: "2026-07-24T11:00:00.000Z",
        locked_until: "2026-07-24T13:00:00.000Z",
      }),
      makeRow({
        video_id: "video-future",
        next_measurement_at: "2026-07-24T13:00:00.000Z",
      }),
      makeRow({
        video_id: "video-failed",
        measurement_status: "failed",
        next_measurement_at: "2026-07-24T11:00:00.000Z",
      }),
    ];

    expect(filterDueMeasurementSchedules(rows, 10, nowMs).map((row) => row.video_id)).toEqual([
      "video-due",
    ]);
  });

  it("treats expired locks as unlocked for due selection", () => {
    const rows = [
      makeRow({
        video_id: "video-expired-lock",
        next_measurement_at: "2026-07-24T11:00:00.000Z",
        locked_until: "2026-07-24T11:30:00.000Z",
      }),
    ];

    expect(filterDueMeasurementSchedules(rows, 10, nowMs).map((row) => row.video_id)).toEqual([
      "video-expired-lock",
    ]);
  });
});

describe("acquireMeasurementLock", () => {
  it("is exported for lock acquisition in repository integration", () => {
    expect(typeof acquireMeasurementLock).toBe("function");
  });
});
