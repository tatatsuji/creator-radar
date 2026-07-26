import {
  formatAccumulationProgress,
  formatChartDateTime,
  formatChartTooltip,
  formatCount,
} from "@/lib/format";
import type { VideoHistoryResponse } from "@/lib/snapshots/getVideoHistory";

interface VideoViewsChartProps {
  history: VideoHistoryResponse | null;
  loading: boolean;
}

export function VideoViewsChart({ history, loading }: VideoViewsChartProps) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:h-56">
        <p className="text-sm text-zinc-500">グラフを読み込み中...</p>
      </div>
    );
  }

  if (!history || history.source === "insufficient" || history.points.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 text-center sm:h-56">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-400">グラフを表示できません</p>
          <p className="text-xs leading-relaxed text-zinc-500">
            {history?.meta.pointCount === 1
              ? "計測が1件のみのため、推移グラフは次回以降に表示されます。"
              : "計測データが蓄積されると、再生数の推移をここで確認できます。"}
          </p>
        </div>
      </div>
    );
  }

  const points = history.points;
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 28, left: 12 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const minViews = Math.min(...points.map((point) => point.viewCount));
  const maxViews = Math.max(...points.map((point) => point.viewCount));
  const viewRange = Math.max(maxViews - minViews, 1);

  const coordinates = points.map((point, index) => {
    const x =
      padding.left +
      (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
    const y =
      padding.top +
      innerHeight -
      ((point.viewCount - minViews) / viewRange) * innerHeight;
    return { x, y, point };
  });

  const linePath = coordinates
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? padding.left} ${
    padding.top + innerHeight
  } L ${coordinates[0]?.x ?? padding.left} ${padding.top + innerHeight} Z`;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
      {history.meta ? (
        <p className="mb-3 text-xs text-zinc-500">
          {formatAccumulationProgress(history.meta)}
        </p>
      ) : null}
      <div className="mb-3 flex items-center justify-between text-[11px] text-zinc-500 sm:text-xs">
        <span>{formatCount(minViews)}回</span>
        <span>{formatCount(maxViews)}回</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full sm:h-56"
        role="img"
        aria-label={`${history.rangeLabel}の再生数推移グラフ`}
      >
        <defs>
          <linearGradient id="viewsGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#viewsGradient)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgb(167, 139, 250)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coordinates.map(({ x, y, point }) => (
          <g key={point.capturedAt}>
            <title>{formatChartTooltip(point.capturedAt, point.viewCount)}</title>
            <circle cx={x} cy={y} r="3" fill="rgb(196, 181, 253)" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-zinc-500 sm:text-xs">
        <span>{formatChartDateTime(points[0]?.capturedAt)}</span>
        <span>{formatChartDateTime(points.at(-1)?.capturedAt)}</span>
      </div>
    </div>
  );
}
