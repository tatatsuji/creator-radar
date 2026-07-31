"use client";

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

export function RankingFiltersBar({
  period,
  genre,
  availableGenres,
  onPeriodChange,
  onGenreChange,
}: RankingFiltersBarProps) {
  return (
    <div
      className="flex flex-col gap-2.5 border-b border-white/[0.06] pb-3"
      aria-label="ランキングフィルター"
    >
      <PeriodTabs value={period} onChange={onPeriodChange} />

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          ジャンル
        </p>
        <GenreFilter
          value={genre}
          availableGenres={availableGenres}
          onChange={onGenreChange}
          compact
        />
      </div>
    </div>
  );
}
