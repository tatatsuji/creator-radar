"use client";

import type { RankingPeriod } from "@/types";

const PERIODS: { id: RankingPeriod; label: string }[] = [
  { id: "24h", label: "24時間" },
  { id: "3d", label: "3日間" },
  { id: "7d", label: "7日間" },
];

interface PeriodTabsProps {
  value: RankingPeriod;
  onChange: (period: RankingPeriod) => void;
}

export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  return (
    <div
      className="glass-panel inline-flex gap-1 p-1"
      role="tablist"
      aria-label="集計期間"
    >
      {PERIODS.map((period) => {
        const isActive = value === period.id;

        return (
          <button
            key={period.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(period.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
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
  );
}
