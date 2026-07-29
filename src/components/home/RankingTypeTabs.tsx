"use client";

import { RANKING_TYPE_TABS } from "@/lib/home/rankingType";
import { HOME_UI_RANKING_ONE_LINERS } from "@/lib/ranking/rankingMeta";
import type { HomeUiRankingType } from "@/types/ranking";

interface RankingTypeTabsProps {
  value: HomeUiRankingType;
  onChange: (value: HomeUiRankingType) => void;
}

export function RankingTypeTabs({ value, onChange }: RankingTypeTabsProps) {
  return (
    <div className="space-y-2">
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
              className={`flex min-h-11 shrink-0 flex-col items-start rounded-2xl px-4 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050508] sm:min-w-[7.5rem] ${
                selected
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                  : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-sm font-semibold sm:text-base">{tab.label}</span>
              <span
                className={`mt-0.5 line-clamp-1 text-[11px] font-normal sm:text-xs ${
                  selected ? "text-violet-100/90" : "text-zinc-500"
                }`}
              >
                {HOME_UI_RANKING_ONE_LINERS[tab.id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
