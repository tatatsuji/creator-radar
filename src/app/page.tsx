import { Suspense } from "react";

import { RankingDashboard } from "@/components/rankings/RankingDashboard";
import { parseHomeUrlState } from "@/lib/home/urlState";
import { getRankingsPayload } from "@/lib/ranking/getRankingsPayload";
import {
  getAvailableGenreIds,
  getRankingErrorMessage,
} from "@/lib/youtube/rankings";
import type { GenreId, Video } from "@/types";
import type { RankingReadiness } from "@/types/ranking";

interface HomeProps {
  searchParams: Promise<{
    ranking?: string;
    mode?: string;
    period?: string;
    genre?: string;
  }>;
}

function HomePageFallback() {
  return (
    <div className="app-background flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-zinc-400">読み込み中...</p>
    </div>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const urlState = parseHomeUrlState({
    get: (key) => query[key as keyof typeof query] ?? null,
  });

  let initialVideos: Video[] = [];
  let initialError: string | null = null;
  let availableGenres: GenreId[] = ["all"];
  let initialUpdatedAt = new Date().toISOString();
  let initialDataFreshnessAt: string | null = null;
  let initialMetricsSummary = { measured: 0, estimated: 0 };
  let initialReadiness: RankingReadiness = {
    status: "ready",
    eligibleCount: 0,
    requiredCount: 0,
    message: "",
  };

  try {
    availableGenres = await getAvailableGenreIds();
    const payload = await getRankingsPayload(
      urlState.ranking,
      urlState.period,
      urlState.genre,
    );
    initialVideos = payload.videos;
    initialUpdatedAt = payload.updatedAt;
    initialDataFreshnessAt = payload.dataFreshnessAt;
    initialMetricsSummary = payload.metricsSummary;
    initialReadiness = payload.readiness;
  } catch (error) {
    initialError = getRankingErrorMessage(error);
  }

  return (
    <Suspense fallback={<HomePageFallback />}>
      <RankingDashboard
        initialRanking={urlState.ranking}
        initialVideos={initialVideos}
        initialPeriod={urlState.period}
        initialGenre={urlState.genre}
        initialUpdatedAt={initialUpdatedAt}
        initialDataFreshnessAt={initialDataFreshnessAt}
        initialMetricsSummary={initialMetricsSummary}
        initialReadiness={initialReadiness}
        initialAvailableGenres={availableGenres}
        initialError={initialError}
      />
    </Suspense>
  );
}
