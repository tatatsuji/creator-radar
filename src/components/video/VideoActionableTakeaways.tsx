import {
  getActionableCategoryLabel,
  getActionableTakeaways,
} from "@/lib/video/actionableInsights";
import type { Video } from "@/types";

interface VideoActionableTakeawaysProps {
  video: Video;
  variant?: "default" | "prominent";
}

export function VideoActionableTakeaways({
  video,
  variant = "default",
}: VideoActionableTakeawaysProps) {
  const takeaways = getActionableTakeaways(video);

  if (takeaways.length === 0) {
    return null;
  }

  const isProminent = variant === "prominent";

  return (
    <section
      className={`glass-panel space-y-4 p-4 sm:p-6 ${
        isProminent
          ? "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-transparent"
          : ""
      }`}
      aria-labelledby="actionable-takeaways-heading"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
          今日試せること
        </p>
        <h2
          id="actionable-takeaways-heading"
          className="text-lg font-semibold text-zinc-100"
        >
          真似できるポイント
        </h2>
        {!isProminent ? (
          <p className="text-sm text-zinc-500">
            この動画から取り入れやすい構成・タイミングのヒントです。
          </p>
        ) : null}
      </div>

      <ul className={`grid gap-3 ${isProminent ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        {takeaways.map((item) => (
          <li
            key={item.category}
            className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">
              {getActionableCategoryLabel(item.category)}
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-100">
              {item.tip}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {item.observation}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
