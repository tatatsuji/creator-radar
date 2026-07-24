"use client";

import { useId } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputId = useId();

  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor={inputId} className="sr-only">
        動画を検索
      </label>
      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
        />
      </svg>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="動画タイトル・チャンネル名で検索..."
        className="glass-panel h-11 w-full rounded-2xl border-white/10 bg-white/[0.03] py-2 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
  );
}
