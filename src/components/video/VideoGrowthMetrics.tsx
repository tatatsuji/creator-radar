import {
  formatDurationSeconds,
  formatViewDelta,
  formatViewsPerSubscriber,
} from "@/lib/format";
import { getVelocityDisplay, getVelocityLabel } from "@/lib/ranking/metrics";
import {
  formatRankingScoreValue,
  formatTotalViews,
  getPeriodIncreaseLabel,
} from "@/lib/video/detailDisplay";
import { RANKING_REFERENCE_LABEL } from "@/lib/home/copy";
import type { RankingPeriod, Video } from "@/types";

interface VideoGrowthMetricsProps {
  video: Video;
  period: RankingPeriod;
  compact?: boolean;
}

interface MetricItem {
  key: string;
  label: string;
  value: string;
  accent?: boolean;
  note?: string;
}

export function VideoGrowthMetrics({
  video,
  period,
  compact = false,
}: VideoGrowthMetricsProps) {
  const velocity = getVelocityDisplay(video, period);
  const isMeasured = video.metrics.metricsSource === "measured";
  const metrics = buildVisibleMetrics({ video, period, velocity, isMeasured });

  if (metrics.length === 0) {
    return null;
  }

  return (
    <section
      className={compact ? "space-y-4" : "space-y-4"}
      aria-labelledby={compact ? undefined : "growth-metrics-heading"}
    >
      {!compact ? (
        <div>
          <h2 id="growth-metrics-heading" className="text-lg font-semibold text-zinc-100">
            指標の内訳
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            ランキングと同じ基準です。推定値と実測値を混同しないよう、出所を確認してください。
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            accent={metric.accent}
            note={metric.note}
          />
        ))}
      </div>
    </section>
  );
}

function buildVisibleMetrics({
  video,
  period,
  velocity,
  isMeasured,
}: {
  video: Video;
  period: RankingPeriod;
  velocity: ReturnType<typeof getVelocityDisplay>;
  isMeasured: boolean;
}): MetricItem[] {
  const items: MetricItem[] = [];

  if (video.metrics.viewDelta > 0) {
    items.push({
      key: "view-delta",
      label: getPeriodIncreaseLabel(period),
      value: formatViewDelta(video.metrics.viewDelta),
      accent: isMeasured,
      note: isMeasured ? "実測ベース" : "推定ベース",
    });
  }

  if (velocity.numeric > 0) {
    items.push({
      key: "velocity",
      label: getVelocityLabel(video.metrics.metricsSource),
      value: `${velocity.value}${velocity.unit}`,
      accent: true,
      note: "現在の再生速度",
    });
  }

  if (video.metrics.rankingScore > 0) {
    items.push({
      key: "ranking-score",
      label: RANKING_REFERENCE_LABEL,
      value: formatRankingScoreValue(video.metrics.rankingScore),
      accent: true,
    });
  }

  if (video.viewCount > 0) {
    items.push({
      key: "view-count",
      label: "総再生数",
      value: formatTotalViews(video.viewCount),
    });
  }

  if (
    !video.channel.subscriberCountHidden &&
    video.metrics.viewsPerSubscriber > 0
  ) {
    items.push({
      key: "views-per-subscriber",
      label: "再生/登録者比",
      value: formatViewsPerSubscriber(
        video.metrics.viewsPerSubscriber,
        video.channel.subscriberCountHidden,
      ),
    });
  }

  if (video.durationSeconds && video.durationSeconds > 0) {
    items.push({
      key: "duration",
      label: "動画時間",
      value: formatDurationSeconds(video.durationSeconds),
    });
  }

  return items;
}

function MetricCard({
  label,
  value,
  accent = false,
  note,
}: {
  label: string;
  value: string;
  accent?: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-[11px] font-medium leading-snug text-zinc-500 sm:text-xs">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-base font-semibold tabular-nums sm:text-lg ${
          accent ? "text-violet-300" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      {note ? (
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{note}</p>
      ) : null}
    </div>
  );
}
