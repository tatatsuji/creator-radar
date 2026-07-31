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
import type { HomeUiRankingType, RankingReadiness } from "@/types/ranking";

interface RankingDashboardProps {
  initialRanking?: HomeUiRankingType;
  initialVideos: Video[];
  initialPeriod?: RankingPeriod;
  initialGenre?: GenreId;
  initialUpdatedAt?: string;
  initialDataFreshnessAt?: string | null;
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
        format: partial.format ?? urlState.format,
      };
      const query = buildHomeSearchParams(next).toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, urlState.genre, urlState.period, urlState.ranking, urlState.format],
  );

  const setRanking = useCallback(
    (ranking: HomeUiRankingType) => {
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
        <HomeHero dataFreshnessAt={initialDataFreshnessAt} />

        <div className="mt-4 space-y-4 sm:mt-5">
          <RankingTypeTabs value={urlState.ranking} onChange={setRanking} />

          <RankingPanel
          active
          ranking={urlState.ranking}
          searchQuery={searchQuery}
          period={urlState.period}
          genre={urlState.genre}
          format={urlState.format}
          homeUrlState={urlState}
          onPeriodChange={(period) => updateHomeUrl({ period })}
          onGenreChange={(genre) => {
            const partial: Partial<HomeUrlState> = { genre };
            if (genre === "shorts" || urlState.format === "short") {
              partial.format = "all";
            }
            updateHomeUrl(partial);
          }}
          onFormatChange={(format) => updateHomeUrl({ format })}
          onViewBuzz={() => setRanking("buzz")}
          initialVideos={useInitialPayload ? initialVideos : []}
          initialPeriod={initialPeriod}
          initialGenre={initialGenre}
          initialUpdatedAt={initialUpdatedAt}
          initialDataFreshnessAt={initialDataFreshnessAt}
          initialReadiness={useInitialPayload ? initialReadiness : undefined}
          initialAvailableGenres={initialAvailableGenres}
          initialError={useInitialPayload ? initialError : null}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
