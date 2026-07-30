import {
  getActionableCategoryLabel,
  getActionableTakeaways,
} from "@/lib/video/actionableInsights";
import type { Video } from "@/types";

interface VideoActionableTakeawaysProps {
  video: Video;
}

const CATEGORY_ICONS: Record<string, string> = {
  title: "✏️",
  timing: "🕐",
  format: "🎬",
  reach: "📈",
};

export function VideoActionableTakeaways({ video }: VideoActionableTakeawaysProps) {
  const takeaways = getActionableTakeaways(video);

  if (takeaways.length === 0) {
    return null;
  }

  return (
    <section
      className="glass-panel space-y-4 p-4 sm:p-6"
      aria-labelledby="actionable-takeaways-heading"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
          真似できるポイント
        </p>
        <h2
          id="actionable-takeaways-heading"
          className="text-lg font-semibold text-zinc-100"
        >
          自分の動画に活かせる参考パターン
        </h2>
        <p className="text-sm text-zinc-500">
          この動画から読み取れる構成・タイミングのヒントです。今日から試せる参考としてご活用ください。
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {takeaways.map((item) => (
          <li
            key={item.category}
            className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-base">
                {CATEGORY_ICONS[item.category] ?? "💡"}
              </span>
              <p className="text-sm font-semibold text-amber-100/90">
                {getActionableCategoryLabel(item.category)}
              </p>
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-200">
              {item.observation}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              → {item.tip}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
