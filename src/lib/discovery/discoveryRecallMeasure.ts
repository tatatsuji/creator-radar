import type {
  DiscoveryRecallGroundTruth,
  GroundTruthSetId,
} from "@/lib/discovery/discoveryRecallGroundTruth";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { CandidateDiscoveryRow } from "@/types/database";
import type { DiscoverySourceType } from "@/types/observability";

export interface DiscoveryRecallVideoResult {
  videoId: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  buzzScore: number;
  groundTruthSet?: GroundTruthSetId;
  categoryId?: string;
  discovered: boolean;
  hoursToDiscovery: number | null;
  firstDiscoveredAt: string | null;
  firstSource: DiscoverySourceType | null;
  firstSourceKey: string | null;
  allSources: DiscoverySourceType[];
  inVideosTable: boolean;
}

export interface DiscoveryRecallSetResult {
  setId: GroundTruthSetId;
  groundTruthCount: number;
  discoveredCount: number;
  recall: number;
  recallPercent: number;
  missedCount: number;
  medianHours: number | null;
  p90Hours: number | null;
  within6h: number;
  within12h: number;
  within24h: number;
  within72h: number;
}

export interface DiscoveryRecallMeasureResult {
  measuredAt: string;
  groundTruthGeneratedAt: string;
  groundTruthCount: number;
  discoveredCount: number;
  recall: number;
  recallPercent: number;
  missedCount: number;
  missedVideoIds: string[];
  byFirstSource: Record<string, number>;
  byAllSources: Record<string, number>;
  byCategory: Record<string, { total: number; discovered: number; recall: number }>;
  latency: {
    discoveredWithLatency: number;
    medianHours: number | null;
    p90Hours: number | null;
    within6h: number;
    within12h: number;
    within24h: number;
    within72h: number;
  };
  sets: DiscoveryRecallSetResult[];
  overallRecall: number;
  mainstreamBuzzRecall: number | null;
  emergingCreatorRecall: number | null;
  shortFormRecall: number | null;
  liveRecall: number | null;
  videos: DiscoveryRecallVideoResult[];
}

function hoursBetween(startIso: string, endIso: string): number {
  return Math.max(0, (Date.parse(endIso) - Date.parse(startIso)) / (60 * 60 * 1000));
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? null;
}

function pickFirstDiscovery(input: {
  discoveries: CandidateDiscoveryRow[];
  videoFirstDiscoveredAt: string | null;
}): {
  firstDiscoveredAt: string | null;
  firstSource: DiscoverySourceType | null;
  firstSourceKey: string | null;
  allSources: DiscoverySourceType[];
} {
  const sorted = [...input.discoveries].sort(
    (left, right) =>
      Date.parse(left.discovered_at) - Date.parse(right.discovered_at),
  );

  const allSources = [
    ...new Set(sorted.map((row) => row.source_type as DiscoverySourceType)),
  ];

  const earliestDiscovery = sorted[0];
  if (earliestDiscovery) {
    return {
      firstDiscoveredAt: earliestDiscovery.discovered_at,
      firstSource: earliestDiscovery.source_type as DiscoverySourceType,
      firstSourceKey: earliestDiscovery.source_key,
      allSources,
    };
  }

  if (input.videoFirstDiscoveredAt) {
    return {
      firstDiscoveredAt: input.videoFirstDiscoveredAt,
      firstSource: null,
      firstSourceKey: null,
      allSources,
    };
  }

  return {
    firstDiscoveredAt: null,
    firstSource: null,
    firstSourceKey: null,
    allSources,
  };
}

function computeSetMetrics(
  setVideos: DiscoveryRecallVideoResult[],
  setId: GroundTruthSetId,
): DiscoveryRecallSetResult {
  const discovered = setVideos.filter((video) => video.discovered);
  const latencyHours = discovered
    .map((video) => video.hoursToDiscovery)
    .filter((hours): hours is number => hours != null);

  const recall =
    setVideos.length > 0 ? discovered.length / setVideos.length : 0;

  return {
    setId,
    groundTruthCount: setVideos.length,
    discoveredCount: discovered.length,
    recall,
    recallPercent: Math.round(recall * 1000) / 10,
    missedCount: setVideos.length - discovered.length,
    medianHours: percentile(latencyHours, 0.5),
    p90Hours: percentile(latencyHours, 0.9),
    within6h: latencyHours.filter((hours) => hours <= 6).length,
    within12h: latencyHours.filter((hours) => hours <= 12).length,
    within24h: latencyHours.filter((hours) => hours <= 24).length,
    within72h: latencyHours.filter((hours) => hours <= 72).length,
  };
}

export async function measureDiscoveryRecall(
  groundTruth: DiscoveryRecallGroundTruth,
): Promise<DiscoveryRecallMeasureResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();
  const allSetVideos = groundTruth.sets?.flatMap((set) => set.videos) ?? groundTruth.videos;
  const videoIds = [...new Set(allSetVideos.map((video) => video.videoId))];

  const { data: discoveryRows, error: discoveryError } = await supabase
    .from("candidate_discoveries")
    .select("*")
    .in("video_id", videoIds);

  if (discoveryError) {
    throw new Error(`candidate_discoveries lookup failed: ${discoveryError.message}`);
  }

  const { data: videoRows, error: videoError } = await supabase
    .from("videos")
    .select("youtube_video_id,first_discovered_at,category_id")
    .in("youtube_video_id", videoIds);

  if (videoError) {
    throw new Error(`videos lookup failed: ${videoError.message}`);
  }

  const discoveriesByVideo = new Map<string, CandidateDiscoveryRow[]>();
  for (const row of (discoveryRows ?? []) as CandidateDiscoveryRow[]) {
    const list = discoveriesByVideo.get(row.video_id) ?? [];
    list.push(row);
    discoveriesByVideo.set(row.video_id, list);
  }

  const firstDiscoveredByVideo = new Map<string, string | null>(
    (videoRows ?? []).map((row) => [
      row.youtube_video_id as string,
      (row.first_discovered_at as string | null) ?? null,
    ]),
  );

  const gtByVideoId = new Map(
    allSetVideos.map((video) => [video.videoId, video]),
  );

  const videos: DiscoveryRecallVideoResult[] = [];
  const latencyHours: number[] = [];
  const byFirstSource: Record<string, number> = {};
  const byAllSources: Record<string, number> = {};
  const byCategory: Record<string, { total: number; discovered: number; recall: number }> =
    {};
  const missedVideoIds: string[] = [];

  for (const videoId of videoIds) {
    const gt = gtByVideoId.get(videoId);
    if (!gt) {
      continue;
    }

    const discoveries = discoveriesByVideo.get(videoId) ?? [];
    const videoFirstDiscoveredAt = firstDiscoveredByVideo.get(videoId) ?? null;
    const first = pickFirstDiscovery({ discoveries, videoFirstDiscoveredAt });

    const discovered = Boolean(first.firstDiscoveredAt);
    const hoursToDiscovery =
      discovered && first.firstDiscoveredAt
        ? hoursBetween(gt.publishedAt, first.firstDiscoveredAt)
        : null;

    if (discovered) {
      if (hoursToDiscovery != null) {
        latencyHours.push(hoursToDiscovery);
      }
      const sourceKey = first.firstSource ?? "unknown";
      byFirstSource[sourceKey] = (byFirstSource[sourceKey] ?? 0) + 1;
      for (const source of first.allSources) {
        byAllSources[source] = (byAllSources[source] ?? 0) + 1;
      }
    } else {
      missedVideoIds.push(videoId);
    }

    const categoryKey = gt.categoryId ?? "unknown";
    const categoryStats = byCategory[categoryKey] ?? {
      total: 0,
      discovered: 0,
      recall: 0,
    };
    categoryStats.total += 1;
    if (discovered) {
      categoryStats.discovered += 1;
    }
    categoryStats.recall =
      categoryStats.total > 0
        ? categoryStats.discovered / categoryStats.total
        : 0;
    byCategory[categoryKey] = categoryStats;

    videos.push({
      videoId: gt.videoId,
      title: gt.title,
      publishedAt: gt.publishedAt,
      viewCount: gt.viewCount,
      buzzScore: gt.buzzScore,
      groundTruthSet: gt.groundTruthSet,
      categoryId: gt.categoryId,
      discovered,
      hoursToDiscovery,
      firstDiscoveredAt: first.firstDiscoveredAt,
      firstSource: first.firstSource,
      firstSourceKey: first.firstSourceKey,
      allSources: first.allSources,
      inVideosTable: firstDiscoveredByVideo.has(videoId),
    });
  }

  const discoveredCount = videos.filter((video) => video.discovered).length;
  const recall =
    groundTruth.videos.length > 0
      ? discoveredCount / groundTruth.videos.length
      : 0;

  const sets: DiscoveryRecallSetResult[] = (groundTruth.sets ?? []).map((set) => {
    const setVideoIds = new Set(set.videos.map((video) => video.videoId));
    const setResults = videos.filter((video) => setVideoIds.has(video.videoId));
    return computeSetMetrics(setResults, set.setId);
  });

  const findSetRecall = (setId: GroundTruthSetId): number | null => {
    const set = sets.find((row) => row.setId === setId);
    return set ? set.recall : null;
  };

  return {
    measuredAt: new Date().toISOString(),
    groundTruthGeneratedAt: groundTruth.generatedAt,
    groundTruthCount: groundTruth.videos.length,
    discoveredCount,
    recall,
    recallPercent: Math.round(recall * 1000) / 10,
    missedCount: missedVideoIds.length,
    missedVideoIds,
    byFirstSource,
    byAllSources,
    byCategory,
    latency: {
      discoveredWithLatency: latencyHours.length,
      medianHours: percentile(latencyHours, 0.5),
      p90Hours: percentile(latencyHours, 0.9),
      within6h: latencyHours.filter((hours) => hours <= 6).length,
      within24h: latencyHours.filter((hours) => hours <= 24).length,
      within72h: latencyHours.filter((hours) => hours <= 72).length,
      within12h: latencyHours.filter((hours) => hours <= 12).length,
    },
    sets,
    overallRecall: recall,
    mainstreamBuzzRecall: findSetRecall("mainstream_buzz"),
    emergingCreatorRecall: findSetRecall("emerging_creator"),
    shortFormRecall: findSetRecall("short_form"),
    liveRecall: findSetRecall("live"),
    videos,
  };
}
