"use client";

import { RANKING_TYPE_TABS } from "@/lib/home/rankingType";
import type { RankingType } from "@/types/ranking";

interface RankingTypeTabsProps {
  value: RankingType;
  onChange: (value: RankingType) => void;
}

export function RankingTypeTabs({ value, onChange }: RankingTypeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="ランキング種別"
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {RANKING_TYPE_TABS.map((tab) => {
        const selected = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`home-ranking-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`home-ranking-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508] sm:px-5 sm:text-base ${
              selected
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
