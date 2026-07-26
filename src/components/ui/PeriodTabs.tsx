"use client";

import { RANKING_PERIODS } from "@/lib/ranking/periods";
import type { RankingPeriod } from "@/types";

interface PeriodTabsProps {
  value: RankingPeriod;
  onChange: (period: RankingPeriod) => void;
}

export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto scroll-tabs px-1">
      <div
        className="glass-panel inline-flex min-w-max gap-1 p-1"
        role="tablist"
        aria-label="集計期間"
      >
        {RANKING_PERIODS.map((period) => {
          const isActive = value === period.id;

          return (
            <button
              key={period.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(period.id)}
              className={`min-h-11 shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {period.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
