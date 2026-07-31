import { describe, expect, it } from "vitest";

import {
  classifyYouTubeErrorMessage,
  classifyYouTubeFetchError,
  YouTubeBatchRequestError,
} from "@/lib/youtube/apiErrors";

describe("classifyYouTubeErrorMessage", () => {
  it("classifies quota and network errors separately from video misses", () => {
    expect(classifyYouTubeErrorMessage("quotaExceeded")).toBe("quotaExceeded");
    expect(classifyYouTubeErrorMessage("dailyLimitExceeded")).toBe(
      "dailyLimitExceeded",
    );
    expect(classifyYouTubeErrorMessage("fetch failed network error")).toBe(
      "network_error",
    );
    expect(classifyYouTubeErrorMessage("backendError")).toBe("backendError");
  });
});

describe("classifyYouTubeFetchError", () => {
  it("wraps unknown errors as batch request errors", () => {
    const error = classifyYouTubeFetchError(new Error("quotaExceeded"));
    expect(error).toBeInstanceOf(YouTubeBatchRequestError);
    expect(error.kind).toBe("quotaExceeded");
  });
});
