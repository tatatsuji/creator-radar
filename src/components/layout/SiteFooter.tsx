import Link from "next/link";

import { SERVICE_TAGLINE } from "@/lib/home/copy";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050508]/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 safe-bottom sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <p className="text-sm text-zinc-500">Creator Radar — {SERVICE_TAGLINE}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/about" className="text-zinc-400 transition hover:text-zinc-200">
            Creator Radarについて
          </Link>
          <Link href="/data" className="text-zinc-400 transition hover:text-zinc-200">
            データについて
          </Link>
        </div>
      </div>
    </footer>
  );
}
