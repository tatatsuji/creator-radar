import Link from "next/link";

import type { HomeUrlState } from "@/lib/home/urlState";
import { getVideoNextReferences } from "@/lib/video/nextReferences";

interface VideoNextReferencesProps {
  homeUrlState: HomeUrlState;
}

export function VideoNextReferences({ homeUrlState }: VideoNextReferencesProps) {
  const links = getVideoNextReferences(homeUrlState);

  return (
    <section
      className="glass-panel space-y-4 p-4 sm:p-6"
      aria-labelledby="next-references-heading"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/90">
          次に参考にすべきもの
        </p>
        <h2
          id="next-references-heading"
          className="text-lg font-semibold text-zinc-100"
        >
          このあと何を見ればいい？
        </h2>
        <p className="text-sm text-zinc-500">
          1本の分析で終わらせず、別の視点・ジャンル・形式も見比べると成功パターンが見えやすくなります。
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              href={link.href}
              className="block rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-sky-500/30 hover:bg-sky-500/[0.04]"
            >
              <p className="text-sm font-semibold text-zinc-100">{link.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                {link.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
