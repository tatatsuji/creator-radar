import { describe, expect, it } from "vitest";

import { DEFAULT_HOME_URL_STATE } from "@/lib/home/urlState";
import { resolveActiveContentFilter } from "@/lib/ranking/rankingViewContext";

describe("rankingViewContext", () => {
  it("resolves content filters from URL state", () => {
    expect(
      resolveActiveContentFilter({ ...DEFAULT_HOME_URL_STATE, format: "short" }),
    ).toBe("shorts");
    expect(
      resolveActiveContentFilter({ ...DEFAULT_HOME_URL_STATE, genre: "game" }),
    ).toBe("genre");
    expect(resolveActiveContentFilter(DEFAULT_HOME_URL_STATE)).toBeNull();
  });
});
