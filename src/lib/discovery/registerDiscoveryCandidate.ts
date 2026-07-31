import {
  inferFormatHintFromVideo,
  type DiscoveryFormatHint,
} from "@/lib/discovery/discoveryMetadata";
import { recordDiscovery } from "@/lib/discovery/repository";
import { upsertSchedule } from "@/lib/measurement/scheduleRepository";
import {
  findExistingVideoIds,
  touchVideoDiscoveryStats,
  upsertChannelRecord,
  upsertVideoRecord,
} from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { GenreId } from "@/types";
import type { DiscoverySourceType } from "@/types/observability";
import type { UpsertChannelInput, UpsertVideoInput } from "@/types/database";

export interface RegisterDiscoveryCandidateInput {
  video: UpsertVideoInput;
  channel: UpsertChannelInput;
  sourceType: DiscoverySourceType;
  sourceKey: string;
  genreHint?: GenreId | null;
  formatHint?: DiscoveryFormatHint | null;
  searchQuery?: string | null;
  metadata?: Record<string, unknown> | null;
  registrationPath?: string;
  discoveredAt?: string;
  ensureSchedule?: boolean;
}

export interface RegisterDiscoveryCandidateResult {
  videoInserted: boolean;
  discoveryInserted: boolean;
  scheduleCreated: boolean;
}

export interface RegisterDiscoveryCandidateDeps {
  upsertChannel: typeof upsertChannelRecord;
  upsertVideo: typeof upsertVideoRecord;
  recordDiscovery: typeof recordDiscovery;
  upsertSchedule: typeof upsertSchedule;
  findExistingVideoIds: typeof findExistingVideoIds;
}

const defaultDeps: RegisterDiscoveryCandidateDeps = {
  upsertChannel: upsertChannelRecord,
  upsertVideo: upsertVideoRecord,
  recordDiscovery,
  upsertSchedule,
  findExistingVideoIds,
};

export async function registerDiscoveryCandidate(
  input: RegisterDiscoveryCandidateInput,
  deps: RegisterDiscoveryCandidateDeps = defaultDeps,
): Promise<RegisterDiscoveryCandidateResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const discoveredAt = input.discoveredAt ?? new Date().toISOString();
  const existingVideoIds = await deps.findExistingVideoIds([input.video.youtubeVideoId]);
  const wasExisting = existingVideoIds.has(input.video.youtubeVideoId);

  await deps.upsertChannel(input.channel);
  await deps.upsertVideo(input.video);

  const formatHint =
    input.formatHint ??
    inferFormatHintFromVideo({
      isShort: input.video.isShort,
      isLive: input.video.isLive,
    });

  const discoveryResult = await deps.recordDiscovery({
    videoId: input.video.youtubeVideoId,
    channelId: input.channel.youtubeChannelId,
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
    discoveredAt,
    genreHint: input.genreHint ?? null,
    formatHint,
    searchQuery: input.searchQuery ?? null,
    metadata: {
      registrationPath: input.registrationPath,
      ...(input.metadata ?? {}),
    },
  });

  let scheduleCreated = false;
  if (input.ensureSchedule !== false) {
    const scheduleResult = await deps.upsertSchedule(input.video.youtubeVideoId);
    scheduleCreated = scheduleResult.status === "created";
  }

  return {
    videoInserted: !wasExisting,
    discoveryInserted: discoveryResult === "inserted",
    scheduleCreated,
  };
}
