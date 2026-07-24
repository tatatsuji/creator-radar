import type { MetricsSource } from "@/types";

interface MetricsSourceBadgeProps {
  source?: MetricsSource;
  className?: string;
}

export function MetricsSourceBadge({
  source = "estimated",
  className = "",
}: MetricsSourceBadgeProps) {
  const isMeasured = source === "measured";

  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isMeasured
          ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
          : "border border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
      } ${className}`}
    >
      {isMeasured ? "実測" : "推定"}
    </span>
  );
}
