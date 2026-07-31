"use client";

import { useEffect, useState } from "react";

import { ContentFormatFilterBar } from "@/components/ui/ContentFormatFilter";
import { GenreFilter } from "@/components/ui/GenreFilter";
import { PeriodTabs } from "@/components/ui/PeriodTabs";
import type { ContentFormatFilter } from "@/lib/home/contentFormat";
import type { GenreId, RankingPeriod } from "@/types";

interface RankingFiltersBarProps {
  period: RankingPeriod;
  genre: GenreId;
  format: ContentFormatFilter;
  availableGenres: GenreId[];
  onPeriodChange: (period: RankingPeriod) => void;
  onGenreChange: (genre: GenreId) => void;
  onFormatChange: (format: ContentFormatFilter) => void;
}

function hasActiveFilters(genre: GenreId, format: ContentFormatFilter): boolean {
  return genre !== "all" || format !== "all";
}

export function RankingFiltersBar({
  period,
  genre,
  format,
  availableGenres,
  onPeriodChange,
  onGenreChange,
  onFormatChange,
}: RankingFiltersBarProps) {
  const filtersActive = hasActiveFilters(genre, format);
  const [expanded, setExpanded] = useState(filtersActive);

  useEffect(() => {
    if (filtersActive) {
      setExpanded(true);
    }
  }, [filtersActive]);

  function clearFilters() {
    onGenreChange("all");
    onFormatChange("all");
    setExpanded(false);
  }

  const showSecondaryFilters = expanded || filtersActive;

  return (
    <div
      className="flex flex-col gap-2 border-b border-white/[0.06] pb-3"
      aria-label="ランキングフィルター"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodTabs value={period} onChange={onPeriodChange} />
        <div className="flex shrink-0 items-center gap-2">
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-9 rounded-lg px-2.5 text-xs font-medium text-violet-300 transition hover:text-violet-200"
            >
              解除
            </button>
          ) : null}
          {!showSecondaryFilters ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="min-h-9 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 text-xs font-medium text-zinc-400 transition hover:border-white/15 hover:text-zinc-200"
              aria-expanded={false}
            >
              絞り込み
            </button>
          ) : null}
        </div>
      </div>

      {showSecondaryFilters ? (
        <div className="space-y-2 pt-1">
          <GenreFilter
            value={genre}
            availableGenres={availableGenres}
            onChange={onGenreChange}
          />
          <ContentFormatFilterBar value={format} onChange={onFormatChange} />
        </div>
      ) : null}
    </div>
  );
}
