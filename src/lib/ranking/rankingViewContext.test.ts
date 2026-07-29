import { describe, expect, it } from "vitest";

import { DEFAULT_HOME_URL_STATE } from "@/lib/home/urlState";
import { resolveActiveViewFromState } from "@/lib/ranking/rankingViewContext";

describe("rankingViewContext", () => {
  it("resolves shorts and genre views from URL state", () => {
    expect(
      resolveActiveViewFromState({ ...DEFAULT_HOME_URL_STATE, format: "short" }),
    ).toBe("shorts");
    expect(
      resolveActiveViewFromState({ ...DEFAULT_HOME_URL_STATE, genre: "game" }),
    ).toBe("genre");
    expect(resolveActiveViewFromState(DEFAULT_HOME_URL_STATE)).toBe("buzz");
  });
});
