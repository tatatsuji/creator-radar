"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  buildHomeSearchParams,
  type HomeUrlState,
} from "@/lib/home/urlState";
import {
  CONTENT_FILTER_DEFINITIONS,
  getContentFilterDefinition,
  type ContentFilterViewId,
} from "@/lib/ranking/rankingMeta";
import { resolveActiveContentFilter } from "@/lib/ranking/rankingViewContext";
import type { GenreId } from "@/types";

interface ContentFilterShortcutsProps {
  homeUrlState: HomeUrlState;
}

function buildFilterState(
  filterId: ContentFilterViewId,
  current: HomeUrlState,
): HomeUrlState {
  switch (filterId) {
    case "shorts":
      return { ...current, format: "short" };
    case "live":
      return { ...current, format: "live" };
    case "genre":
      return {
        ...current,
        genre: current.genre === "all" ? ("game" as GenreId) : current.genre,
      };
    default:
      return current;
  }
}

export function ContentFilterShortcuts({
  homeUrlState,
}: ContentFilterShortcutsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeFilter = resolveActiveContentFilter(homeUrlState);

  function navigate(filterId: ContentFilterViewId) {
    const next = buildFilterState(filterId, homeUrlState);
    const query = buildHomeSearchParams(next).toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearFilters() {
    const next: HomeUrlState = {
      ...homeUrlState,
      genre: "all",
      format: "all",
    };
    const query = buildHomeSearchParams(next).toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5"
      aria-label="表示フィルター"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          絞り込み（ランキングは変わりません）
        </p>
        {activeFilter ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-violet-300 hover:text-violet-200"
          >
            フィルターを解除
          </button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-2">
        {CONTENT_FILTER_DEFINITIONS.map((filter) => {
          const selected = filter.id === activeFilter;
          return (
            <li key={filter.id}>
              <button
                type="button"
                onClick={() => navigate(filter.id)}
                title={filter.description}
                className={`min-h-10 rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
                    : "border-white/[0.08] bg-black/20 text-zinc-300 hover:border-white/15 hover:bg-white/[0.04]"
                }`}
              >
                <span className="block text-sm font-semibold">{filter.label}</span>
                <span className="block text-[11px] text-zinc-400">
                  {filter.oneLiner}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {activeFilter ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          {getContentFilterDefinition(activeFilter).description}
        </p>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          バズ / 伸び始めの一覧を、ジャンル・形式で絞り込めます。
        </p>
      )}
    </div>
  );
}
