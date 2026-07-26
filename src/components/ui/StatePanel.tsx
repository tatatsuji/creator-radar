import type { ReactNode } from "react";

interface StatePanelProps {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "error" | "empty";
}

export function StatePanel({
  title,
  description,
  action,
  tone = "default",
}: StatePanelProps) {
  const toneClasses =
    tone === "error"
      ? "border-red-500/20 bg-red-500/5"
      : tone === "empty"
        ? "border-white/[0.08] bg-white/[0.02]"
        : "border-white/[0.08] bg-white/[0.02]";

  return (
    <div
      className={`glass-panel flex flex-col items-center justify-center px-6 py-16 text-center sm:px-10 ${toneClasses}`}
    >
      <p className="text-lg font-semibold text-zinc-100">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function RankingCardSkeleton() {
  return (
    <article className="glass-card overflow-hidden">
      <div className="aspect-video animate-pulse bg-white/[0.04]" />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-16 animate-pulse rounded-xl bg-violet-500/10" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      </div>
    </article>
  );
}
