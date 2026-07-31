export type YouTubeApiErrorKind =
  | "quotaExceeded"
  | "dailyLimitExceeded"
  | "forbidden"
  | "backendError"
  | "rateLimitExceeded"
  | "timeout"
  | "network_error"
  | "invalid_response"
  | "video_item_missing";

export class YouTubeBatchRequestError extends Error {
  readonly kind: Exclude<YouTubeApiErrorKind, "video_item_missing">;

  constructor(
    kind: Exclude<YouTubeApiErrorKind, "video_item_missing">,
    message: string,
  ) {
    super(message);
    this.name = "YouTubeBatchRequestError";
    this.kind = kind;
  }
}

export function isYouTubeBatchRequestError(
  error: unknown,
): error is YouTubeBatchRequestError {
  return error instanceof YouTubeBatchRequestError;
}

export function classifyYouTubeErrorMessage(message: string): YouTubeApiErrorKind {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("quotaexceeded") ||
    normalized.includes("quota exceeded")
  ) {
    return "quotaExceeded";
  }
  if (
    normalized.includes("dailylimitexceeded") ||
    normalized.includes("daily limit exceeded")
  ) {
    return "dailyLimitExceeded";
  }
  if (normalized.includes("ratelimitexceeded") || normalized.includes("rate limit")) {
    return "rateLimitExceeded";
  }
  if (normalized.includes("forbidden") || normalized.includes("access forbidden")) {
    return "forbidden";
  }
  if (
    normalized.includes("backenderror") ||
    normalized.includes("backend error") ||
    normalized.includes("internal error")
  ) {
    return "backendError";
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "timeout";
  }
  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound")
  ) {
    return "network_error";
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("json") ||
    normalized.includes("unexpected token")
  ) {
    return "invalid_response";
  }

  return "backendError";
}

export function classifyYouTubeFetchError(error: unknown): YouTubeBatchRequestError {
  if (error instanceof YouTubeBatchRequestError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : "YouTube API request failed";
  const kind = classifyYouTubeErrorMessage(message);

  if (kind === "video_item_missing") {
    return new YouTubeBatchRequestError("backendError", message);
  }

  return new YouTubeBatchRequestError(kind, message);
}
