import { getRankingCandidates } from "@/lib/youtube/rankings";
import type { GenreId, RankingPeriod, Video } from "@/types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_DAILY_FETCHES = 3;

interface BuzzFallbackCacheEntry {
  key: string;
  expiresAt: number;
  videos: Video[];
}

let cacheEntry: BuzzFallbackCacheEntry | null = null;
let inflightFetch: Promise<Video[]> | null = null;
let dailyFetchState = {
  dateKey: "",
  count: 0,
};

function getCacheKey(period: RankingPeriod, genre: GenreId): string {
  return `${period}:${genre}`;
}

function getTodayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resetBuzzRankingFallbackState(): void {
  cacheEntry = null;
  inflightFetch = null;
  dailyFetchState = { dateKey: "", count: 0 };
}

export function getBuzzRankingFallbackDailyFetchCount(): number {
  return dailyFetchState.count;
}

export function estimateBuzzFallbackQuotaUnits(): number {
  // search.list (up to 2 attempts) + videos.list + channels.list
  return 202;
}

export async function getBuzzRankingFallbackCandidates(
  period: RankingPeriod,
  genre: GenreId,
): Promise<Video[]> {
  const cacheKey = getCacheKey(period, genre);
  const nowMs = Date.now();

  if (cacheEntry && cacheEntry.key === cacheKey && nowMs < cacheEntry.expiresAt) {
    return cacheEntry.videos;
  }

  const todayKey = getTodayKey();
  if (dailyFetchState.dateKey !== todayKey) {
    dailyFetchState = { dateKey: todayKey, count: 0 };
  }

  if (dailyFetchState.count >= MAX_DAILY_FETCHES) {
    return cacheEntry?.videos ?? [];
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = (async () => {
    try {
      const videos = await getRankingCandidates(period, genre);
      dailyFetchState.count += 1;
      cacheEntry = {
        key: cacheKey,
        expiresAt: Date.now() + CACHE_TTL_MS,
        videos,
      };
      return videos;
    } catch {
      return cacheEntry?.videos ?? [];
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}
