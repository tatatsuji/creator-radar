"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { SearchBar } from "@/components/ui/SearchBar";
import { getPeriodLabel } from "@/lib/ranking/periods";
import type { RankingPeriod } from "@/types";

interface SiteHeaderProps {
  variant?: "home" | "default";
  period?: RankingPeriod;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  backHref?: string;
  backLabel?: string;
}

export function SiteHeader({
  variant = "default",
  period,
  searchValue,
  onSearchChange,
  backHref = "/",
  backLabel = "ランキング",
}: SiteHeaderProps) {
  const showSearch = variant === "home" && onSearchChange !== undefined;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050508]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 safe-top sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          {variant !== "home" ? (
            <Link
              href={backHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          ) : null}

          <Link
            href="/"
            className="group inline-flex min-w-0 flex-1 items-center gap-2 sm:flex-none"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-sm font-bold text-violet-200">
              CR
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-100 group-hover:text-white sm:text-base">
              Creator Radar
            </span>
          </Link>

          {period ? (
            <span className="shrink-0 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
              {getPeriodLabel(period)}
            </span>
          ) : null}

          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            <NavLink href="/about">About</NavLink>
            <NavLink href="/data">データ</NavLink>
          </nav>
        </div>

        {showSearch ? (
          <SearchBar value={searchValue ?? ""} onChange={onSearchChange} />
        ) : null}

        {variant === "home" ? (
          <nav className="flex gap-2 sm:hidden">
            <NavLink href="/about" compact>
              About
            </NavLink>
            <NavLink href="/data" compact>
              データ
            </NavLink>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  compact = false,
}: {
  href: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border border-white/[0.08] text-zinc-400 transition hover:border-white/15 hover:bg-white/5 hover:text-zinc-200 ${
        compact ? "px-3 py-1.5 text-xs font-medium" : "px-3 py-1.5 text-sm"
      }`}
    >
      {children}
    </Link>
  );
}
