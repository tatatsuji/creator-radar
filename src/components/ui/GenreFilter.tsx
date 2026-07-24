"use client";

import { genres } from "@/data/genres";
import type { GenreId } from "@/types";

interface GenreFilterProps {
  value: GenreId;
  onChange: (genre: GenreId) => void;
}

export function GenreFilter({ value, onChange }: GenreFilterProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="ジャンル">
      {genres.map((genre) => {
        const isActive = value === genre.id;

        return (
          <button
            key={genre.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(genre.id)}
            className={`rounded-2xl border px-3.5 py-1.5 text-sm font-medium transition ${
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
  );
}
