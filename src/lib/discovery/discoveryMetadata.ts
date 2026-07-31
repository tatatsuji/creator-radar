import { createHash } from "node:crypto";

import type { GenreId } from "@/types";
import type { VideoContentKind } from "@/lib/discovery/videoClassification";

export type DiscoveryFormatHint = VideoContentKind | "unknown";

export interface DiscoveryMetadataInput {
  period?: string;
  genre?: GenreId;
  genreHint?: GenreId | null;
  formatHint?: DiscoveryFormatHint | null;
  searchQuery?: string | null;
  publishedAt?: string;
  registrationPath?: string;
  watchlistSource?: string | null;
  watchlistCategory?: string | null;
  hotCandidate?: boolean;
  extra?: Record<string, unknown> | null;
}

export function hashDiscoverySearchQuery(query: string): string {
  return createHash("sha256").update(query.trim()).digest("hex");
}

export function buildDiscoveryMetadata(
  input: DiscoveryMetadataInput,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...(input.extra ?? {}),
  };

  if (input.period) {
    metadata.period = input.period;
  }
  if (input.genre) {
    metadata.genre = input.genre;
  }
  if (input.genreHint) {
    metadata.genreHint = input.genreHint;
  }
  if (input.formatHint) {
    metadata.formatHint = input.formatHint;
  }
  if (input.publishedAt) {
    metadata.publishedAt = input.publishedAt;
  }
  if (input.registrationPath) {
    metadata.registrationPath = input.registrationPath;
  }
  if (input.watchlistSource) {
    metadata.watchlistSource = input.watchlistSource;
  }
  if (input.watchlistCategory) {
    metadata.watchlistCategory = input.watchlistCategory;
  }
  if (input.hotCandidate === true) {
    metadata.hotCandidate = true;
  }

  const trimmedQuery = input.searchQuery?.trim();
  if (trimmedQuery) {
    metadata.searchQueryHash = hashDiscoverySearchQuery(trimmedQuery);
  }

  return metadata;
}

export function inferFormatHintFromVideo(input: {
  isShort?: boolean | null;
  isLive?: boolean | null;
}): DiscoveryFormatHint {
  if (input.isLive === true) {
    return "live";
  }
  if (input.isShort === true) {
    return "short";
  }
  if (input.isShort === false && input.isLive === false) {
    return "regular";
  }
  return "unknown";
}
