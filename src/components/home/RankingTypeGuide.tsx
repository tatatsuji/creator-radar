"use client";

import {
  RANKING_TYPE_DESCRIPTIONS,
  RANKING_TYPE_LABELS,
  RANKING_TYPE_ONE_LINERS,
} from "@/lib/ranking/rankingMeta";
import { RANKING_TYPES, type RankingType } from "@/types/ranking";

interface RankingTypeGuideProps {
  active: RankingType;
}

export function RankingTypeGuide({ active }: RankingTypeGuideProps) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5"
      aria-label="ランキング種別の説明"
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        4つのランキングの違い
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {RANKING_TYPES.map((type) => {
          const selected = type === active;
          return (
            <li
              key={type}
              className={`rounded-xl border px-3 py-2.5 transition ${
                selected
                  ? "border-violet-500/40 bg-violet-500/10"
                  : "border-white/[0.06] bg-transparent"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  selected ? "text-violet-100" : "text-zinc-300"
                }`}
              >
                {RANKING_TYPE_LABELS[type]}
              </p>
              <p className="mt-0.5 text-xs text-violet-300/90">
                {RANKING_TYPE_ONE_LINERS[type]}
              </p>
              {selected ? (
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {RANKING_TYPE_DESCRIPTIONS[type]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
