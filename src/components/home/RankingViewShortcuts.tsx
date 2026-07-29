"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  buildHomeSearchParams,
  type HomeUrlState,
} from "@/lib/home/urlState";
import {
  getRankingViewDefinition,
  RANKING_VIEW_DEFINITIONS,
  type RankingViewId,
} from "@/lib/ranking/rankingMeta";
import { resolveActiveViewFromState } from "@/lib/ranking/rankingViewContext";
import type { GenreId } from "@/types";

interface RankingViewShortcutsProps {
  homeUrlState: HomeUrlState;
}

function resolveActiveView(homeUrlState: HomeUrlState): RankingViewId {
  return resolveActiveViewFromState(homeUrlState);
}

function buildViewState(
  viewId: RankingViewId,
  current: HomeUrlState,
): HomeUrlState {
  switch (viewId) {
    case "buzz":
    case "early_rise":
    case "launch_speed":
    case "potential":
      return {
        ...current,
        ranking: viewId,
        format: "all",
        genre: "all",
      };
    case "shorts":
      return {
        ...current,
        ranking: "buzz",
        format: "short",
        genre: "all",
      };
    case "live":
      return {
        ...current,
        ranking: "buzz",
        format: "live",
        genre: "all",
      };
    case "genre":
      return {
        ...current,
        format: "all",
        genre: current.genre === "all" ? ("game" as GenreId) : current.genre,
      };
    default:
      return current;
  }
}

export function RankingViewShortcuts({ homeUrlState }: RankingViewShortcutsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeView = resolveActiveView(homeUrlState);

  function navigate(viewId: RankingViewId) {
    const next = buildViewState(viewId, homeUrlState);
    const query = buildHomeSearchParams(next).toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5"
      aria-label="7つのランキング視点"
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        7つの視点で見る
      </p>
      <ul className="flex flex-wrap gap-2">
        {RANKING_VIEW_DEFINITIONS.map((view) => {
          const selected = view.id === activeView;
          return (
            <li key={view.id}>
              <button
                type="button"
                onClick={() => navigate(view.id)}
                title={view.description}
                className={`min-h-10 rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
                    : "border-white/[0.08] bg-black/20 text-zinc-300 hover:border-white/15 hover:bg-white/[0.04]"
                }`}
              >
                <span className="block text-sm font-semibold">{view.label}</span>
                <span className="block text-[11px] text-zinc-400">
                  {view.oneLiner}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        {getRankingViewDefinition(activeView).description}
      </p>
    </div>
  );
}
