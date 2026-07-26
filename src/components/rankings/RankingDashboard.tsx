"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { HomeHero } from "@/components/home/HomeHero";
import { RankingTypeTabs } from "@/components/home/RankingTypeTabs";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { RankingPanel } from "@/components/rankings/RankingPanel";
import {
  buildHomeSearchParams,
  parseHomeUrlState,
  type HomeUrlState,
} from "@/lib/home/urlState";
import type { GenreId, RankingPeriod, Video } from "@/types";
import type { RankingReadiness, RankingType } from "@/types/ranking";

interface RankingDashboardProps {
  initialRanking?: RankingType;
  initialVideos: Video[];
  initialPeriod?: RankingPeriod;
  initialGenre?: GenreId;
  initialUpdatedAt?: string;
  initialDataFreshnessAt?: string | null;
  initialMetricsSummary?: { measured: number; estimated: number };
  initialReadiness?: RankingReadiness;
  initialAvailableGenres?: GenreId[];
  initialError?: string | null;
}

export function RankingDashboard({
  initialRanking = "buzz",
  initialVideos,
  initialPeriod = "24h",
  initialGenre = "all",
  initialUpdatedAt,
  initialDataFreshnessAt = null,
  initialMetricsSummary = { measured: 0, estimated: 0 },
  initialReadiness = {
    status: "ready",
    eligibleCount: 0,
    requiredCount: 0,
    message: "",
  },
  initialAvailableGenres = ["all"],
  initialError = null,
}: RankingDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  const urlState = useMemo(
    () => parseHomeUrlState(searchParams),
    [searchParams],
  );

  const updateHomeUrl = useCallback(
    (partial: Partial<HomeUrlState>) => {
      const next: HomeUrlState = {
        ranking: partial.ranking ?? urlState.ranking,
        period: partial.period ?? urlState.period,
        genre: partial.genre ?? urlState.genre,
      };
      const query = buildHomeSearchParams(next).toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, urlState.genre, urlState.period, urlState.ranking],
  );

  const setRanking = useCallback(
    (ranking: RankingType) => {
      updateHomeUrl({ ranking });
    },
    [updateHomeUrl],
  );

  const useInitialPayload =
    urlState.ranking === initialRanking &&
    urlState.period === initialPeriod &&
    urlState.genre === initialGenre;

  return (
    <div className="app-background flex min-h-screen flex-col">
      <SiteHeader
        variant="home"
        period={urlState.period}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <section className="mb-6 space-y-5 sm:mb-8">
          <HomeHero />
          <RankingTypeTabs value={urlState.ranking} onChange={setRanking} />
        </section>

        <RankingPanel
          active
          ranking={urlState.ranking}
          searchQuery={searchQuery}
          period={urlState.period}
          genre={urlState.genre}
          homeUrlState={urlState}
          onPeriodChange={(period) => updateHomeUrl({ period })}
          onGenreChange={(genre) => updateHomeUrl({ genre })}
          onViewBuzz={() => setRanking("buzz")}
          initialVideos={useInitialPayload ? initialVideos : []}
          initialPeriod={initialPeriod}
          initialGenre={initialGenre}
          initialUpdatedAt={initialUpdatedAt}
          initialDataFreshnessAt={initialDataFreshnessAt}
          initialMetricsSummary={initialMetricsSummary}
          initialReadiness={useInitialPayload ? initialReadiness : undefined}
          initialAvailableGenres={initialAvailableGenres}
          initialError={useInitialPayload ? initialError : null}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
