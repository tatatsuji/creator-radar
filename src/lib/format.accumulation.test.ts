import { describe, expect, it } from "vitest";

import { formatAccumulationProgress } from "@/lib/format";

describe("formatAccumulationProgress", () => {
  it("describes empty accumulation state", () => {
    expect(
      formatAccumulationProgress({
        pointCount: 0,
        oldestAt: null,
        newestAt: null,
      }),
    ).toBe("計測データはまだありません");
  });

  it("describes a single snapshot", () => {
    expect(
      formatAccumulationProgress({
        pointCount: 1,
        oldestAt: "2026-07-26T06:00:00.000Z",
        newestAt: "2026-07-26T06:00:00.000Z",
      }),
    ).toContain("1件");
  });

  it("describes a measured range", () => {
    const text = formatAccumulationProgress({
      pointCount: 4,
      oldestAt: "2026-07-26T01:00:00.000Z",
      newestAt: "2026-07-26T06:00:00.000Z",
    });

    expect(text).toContain("4件");
    expect(text).toContain("〜");
  });
});
