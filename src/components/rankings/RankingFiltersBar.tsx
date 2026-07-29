"use client";

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

export function RankingFiltersBar({
  period,
  genre,
  format,
  availableGenres,
  onPeriodChange,
  onGenreChange,
  onFormatChange,
}: RankingFiltersBarProps) {
  return (
    <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-white/[0.06] bg-[#050508]/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:rounded-2xl sm:border sm:border-white/[0.08] sm:bg-white/[0.02] sm:px-4 sm:py-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">集計期間</p>
        <PeriodTabs value={period} onChange={onPeriodChange} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">ジャンル</p>
        <GenreFilter
          value={genre}
          availableGenres={availableGenres}
          onChange={onGenreChange}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">動画形式</p>
        <ContentFormatFilterBar value={format} onChange={onFormatChange} />
      </div>
    </div>
  );
}
