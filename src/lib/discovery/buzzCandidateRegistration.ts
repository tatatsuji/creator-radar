import { buildMostPopularSourceKey, buildSearchSourceKey } from "@/lib/discovery/sourceKey";
import { recordDiscovery } from "@/lib/discovery/repository";
import { upsertSchedule } from "@/lib/measurement/scheduleRepository";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  findExistingVideoIds,
  upsertChannelRecord,
  upsertVideoRecord,
} from "@/lib/snapshots/repository";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getPeriodHours } from "@/lib/ranking/periods";
import type { GenreId, RankingPeriod, Video } from "@/types";
import type { DiscoverySourceType } from "@/types/observability";
import type { YouTubeVideoItem } from "@/lib/youtube/types";
import { fetchYouTubeChannelsByIds } from "@/lib/youtube/rankings";

export interface RegisterBuzzCandidatesResult {
  candidatesProcessed: number;
  candidatesSkipped: number;
  videosInserted: number;
  videosUpdated: number;
  discoveriesInserted: number;
  discoveriesDuplicate: number;
  schedulesCreated: number;
  schedulesExisting: number;
  failures: number;
}

export interface BuzzRegistrationContext {
  period: RankingPeriod;
  genre: GenreId;
  sourceType?: DiscoverySourceType;
  sourceKey?: string;
  limit?: number;
}

export interface BuzzCandidateRegistrationDeps {
  findExistingVideoIds: typeof findExistingVideoIds;
  upsertChannel: typeof upsertChannelRecord;
  upsertVideo: typeof upsertVideoRecord;
  recordDiscovery: typeof recordDiscovery;
  upsertSchedule: typeof upsertSchedule;
  fetchChannels: typeof fetchYouTubeChannelsByIds;
}

const defaultDeps: BuzzCandidateRegistrationDeps = {
  findExistingVideoIds,
  upsertChannel: upsertChannelRecord,
  upsertVideo: upsertVideoRecord,
  recordDiscovery,
  upsertSchedule,
  fetchChannels: fetchYouTubeChannelsByIds,
};

function emptyResult(): RegisterBuzzCandidatesResult {
  return {
    candidatesProcessed: 0,
    candidatesSkipped: 0,
    videosInserted: 0,
    videosUpdated: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    schedulesCreated: 0,
    schedulesExisting: 0,
    failures: 0,
  };
}

function isRegisterableYouTubeItem(item: YouTubeVideoItem): boolean {
  if (!item.id?.trim() || !item.snippet?.channelId?.trim()) {
    return false;
  }

  return true;
}

function isRegisterableVideo(video: Video): boolean {
  return Boolean(video.id?.trim() && video.channel.id?.trim());
}

export function buildBuzzRegistrationSource(context: BuzzRegistrationContext): {
  sourceType: DiscoverySourceType;
  sourceKey: string;
} {
  if (context.sourceType && context.sourceKey) {
    return {
      sourceType: context.sourceType,
      sourceKey: context.sourceKey,
    };
  }

  if (context.genre === "all") {
    return {
      sourceType: "search",
      sourceKey: buildSearchSourceKey(`ranking:${context.period}:all`),
    };
  }

  return {
    sourceType: "most_popular",
    sourceKey: buildMostPopularSourceKey("JP", context.genre),
  };
}

export function shouldUseHotMeasurementTier(input: {
  publishedAt: string;
  viewCount: number;
  nowMs?: number;
}): boolean {
  const ageHours =
    (Math.max(0, (input.nowMs ?? Date.now()) - new Date(input.publishedAt).getTime()) /
      (60 * 60 * 1000));
  const periodHotWindowHours = Math.max(24, getPeriodHours("24h"));

  return ageHours <= periodHotWindowHours || input.viewCount >= 50_000;
}

export async function registerBuzzCandidatesFromYouTubeItems(
  items: YouTubeVideoItem[],
  context: BuzzRegistrationContext,
  deps: BuzzCandidateRegistrationDeps = defaultDeps,
): Promise<RegisterBuzzCandidatesResult> {
  if (!isSupabaseConfigured()) {
    return emptyResult();
  }

  const limit =
    context.limit ?? OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert;
  const registerable = items.filter(isRegisterableYouTubeItem).slice(0, limit);

  if (registerable.length === 0) {
    return {
      ...emptyResult(),
      candidatesSkipped: items.length,
    };
  }

  const { sourceType, sourceKey } = buildBuzzRegistrationSource(context);
  const channelIds = [...new Set(registerable.map((item) => item.snippet.channelId))];
  const channels = await deps.fetchChannels(channelIds);
  const existingVideoIds = await deps.findExistingVideoIds(
    registerable.map((item) => item.id),
  );

  const result = emptyResult();
  result.candidatesSkipped = items.length - registerable.length;
  const now = new Date().toISOString();

  for (const item of registerable) {
    try {
      const channel = channels.get(item.snippet.channelId);
      const channelName = channel?.snippet.title ?? item.snippet.channelTitle;
      const subscriberCountHidden =
        channel?.statistics?.hiddenSubscriberCount === true;

      await deps.upsertChannel({
        youtubeChannelId: item.snippet.channelId,
        name: channelName,
        thumbnailUrl: channel?.snippet.thumbnails?.default?.url,
        subscriberCountHidden,
      });

      const wasExisting = existingVideoIds.has(item.id);
      await deps.upsertVideo({
        youtubeVideoId: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelName,
        thumbnailUrl:
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          "",
        publishedAt: item.snippet.publishedAt,
        categoryId: item.snippet.categoryId,
        lastSeenAt: now,
      });

      if (wasExisting) {
        result.videosUpdated += 1;
      } else {
        result.videosInserted += 1;
        existingVideoIds.add(item.id);
      }

      const discoveryResult = await deps.recordDiscovery({
        videoId: item.id,
        channelId: item.snippet.channelId,
        sourceType,
        sourceKey,
        metadata: {
          period: context.period,
          genre: context.genre,
          publishedAt: item.snippet.publishedAt,
          registrationPath: "ranking_discovery",
        },
      });

      if (discoveryResult === "inserted") {
        result.discoveriesInserted += 1;
      } else {
        result.discoveriesDuplicate += 1;
      }

      const scheduleResult = await deps.upsertSchedule(item.id);
      if (scheduleResult.status === "created") {
        result.schedulesCreated += 1;
      } else {
        result.schedulesExisting += 1;
      }

      result.candidatesProcessed += 1;
    } catch {
      result.failures += 1;
    }
  }

  return result;
}

export async function registerBuzzCandidatesFromVideos(
  videos: Video[],
  context: BuzzRegistrationContext,
  deps: BuzzCandidateRegistrationDeps = defaultDeps,
): Promise<RegisterBuzzCandidatesResult> {
  if (!isSupabaseConfigured()) {
    return emptyResult();
  }

  const limit =
    context.limit ?? OBSERVABILITY_CONFIG.batchSize.rankingSnapshotInsert;
  const registerable = videos.filter(isRegisterableVideo).slice(0, limit);

  if (registerable.length === 0) {
    return {
      ...emptyResult(),
      candidatesSkipped: videos.length,
    };
  }

  const { sourceType, sourceKey } = buildBuzzRegistrationSource(context);
  const existingVideoIds = await deps.findExistingVideoIds(
    registerable.map((video) => video.id),
  );

  const result = emptyResult();
  result.candidatesSkipped = videos.length - registerable.length;
  const now = new Date().toISOString();

  for (const video of registerable) {
    try {
      await deps.upsertChannel({
        youtubeChannelId: video.channel.id,
        name: video.channel.name,
        thumbnailUrl: video.channel.thumbnailUrl,
        subscriberCountHidden: video.channel.subscriberCountHidden ?? false,
      });

      const wasExisting = existingVideoIds.has(video.id);
      await deps.upsertVideo({
        youtubeVideoId: video.id,
        title: video.title,
        channelId: video.channel.id,
        channelName: video.channel.name,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        lastSeenAt: now,
      });

      if (wasExisting) {
        result.videosUpdated += 1;
      } else {
        result.videosInserted += 1;
        existingVideoIds.add(video.id);
      }

      const discoveryResult = await deps.recordDiscovery({
        videoId: video.id,
        channelId: video.channel.id,
        sourceType,
        sourceKey,
        metadata: {
          period: context.period,
          genre: context.genre,
          publishedAt: video.publishedAt,
          registrationPath: "ranking_view",
          hotCandidate: shouldUseHotMeasurementTier({
            publishedAt: video.publishedAt,
            viewCount: video.viewCount,
          }),
        },
      });

      if (discoveryResult === "inserted") {
        result.discoveriesInserted += 1;
      } else {
        result.discoveriesDuplicate += 1;
      }

      const scheduleResult = await deps.upsertSchedule(video.id);
      if (scheduleResult.status === "created") {
        result.schedulesCreated += 1;
      } else {
        result.schedulesExisting += 1;
      }

      result.candidatesProcessed += 1;
    } catch {
      result.failures += 1;
    }
  }

  return result;
}
