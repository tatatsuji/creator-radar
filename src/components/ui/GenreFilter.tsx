"use client";

import { genres } from "@/data/genres";
import type { GenreId } from "@/types";

interface GenreFilterProps {
  value: GenreId;
  availableGenres: GenreId[];
  onChange: (genre: GenreId) => void;
}

export function GenreFilter({
  value,
  availableGenres,
  onChange,
}: GenreFilterProps) {
  const visibleGenres = genres.filter((genre) =>
    availableGenres.includes(genre.id),
  );

  return (
    <div className="-mx-1 overflow-x-auto scroll-tabs px-1">
      <div className="flex min-w-max flex-wrap gap-2 sm:flex-wrap" role="group" aria-label="ジャンル">
        {visibleGenres.map((genre) => {
          const isActive = value === genre.id;

          return (
            <button
              key={genre.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(genre.id)}
              className={`min-h-10 shrink-0 rounded-2xl border px-3.5 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200 shadow-sm shadow-violet-500/20"
                  : "border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {genre.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
