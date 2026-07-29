"use client";

import {
  CONTENT_FORMAT_FILTERS,
  type ContentFormatFilter,
} from "@/lib/home/contentFormat";

interface ContentFormatFilterProps {
  value: ContentFormatFilter;
  onChange: (value: ContentFormatFilter) => void;
}

export function ContentFormatFilterBar({
  value,
  onChange,
}: ContentFormatFilterProps) {
  return (
    <div className="-mx-1 overflow-x-auto scroll-tabs px-1">
      <div
        className="flex min-w-max gap-2"
        role="group"
        aria-label="動画形式"
      >
        {CONTENT_FORMAT_FILTERS.map((option) => {
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.id)}
              className={`min-h-10 shrink-0 rounded-2xl border px-3.5 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-100 shadow-sm shadow-cyan-500/20"
                  : "border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
