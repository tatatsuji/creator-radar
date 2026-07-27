import { finalizeBuzzRankingList } from "@/lib/ranking/buzzRankingQuality";
import { finalizeRankedVideos } from "@/lib/ranking/metrics";
import { MAX_RANKING_RESULTS, RANKING_SCORE_NAMES } from "@/lib/ranking/rankingMeta";
import type { SnapshotEnrichedVideo } from "@/lib/ranking/snapshotRankingBase";
import type { RankingPeriod, Video, VideoMetrics } from "@/types";
import type { RankingDisplayInfo } from "@/types/ranking";
import { getViewDeltaLabel } from "@/lib/ranking/periods";
import { formatViewDelta } from "@/lib/format";
import { getVelocityDisplay, getVelocityLabel } from "@/lib/ranking/metrics";

type VideoWithRawScore = Video & {
  metrics: VideoMetrics & { rawScore?: number };
};

function attachDisplay(
  video: Video,
  display: RankingDisplayInfo,
): Video {
  return {
    ...video,
    rankingDisplay: display,
  };
}

export async function buildBuzzRankingVideos(
  videos: Video[],
  period: RankingPeriod,
): Promise<Video[]> {
  const ranked = await finalizeRankedVideos(videos as VideoWithRawScore[], period);
  const qualityFiltered = finalizeBuzzRankingList(ranked, period);

  return qualityFiltered.map((video) => {
    const isMeasured = video.metrics.metricsSource === "measured";
    const heroMetric = isMeasured
      ? {
          label: getViewDeltaLabel(period),
          value: formatViewDelta(video.metrics.viewDelta),
        }
      : (() => {
          const velocity = getVelocityDisplay(video, period);
          return {
            label: "公開後平均再生速度（推定）",
            value: `${velocity.value}${velocity.unit}`,
          };
        })();

    const secondary =
      isMeasured
        ? (() => {
            const velocity = getVelocityDisplay(video, period);
            return {
              label: getVelocityLabel(video.metrics.metricsSource),
              value: `${velocity.value}${velocity.unit}`,
            };
          })()
        : undefined;

    return attachDisplay(video, {
      scoreName: RANKING_SCORE_NAMES.buzz,
      scoreValue: Math.round(video.metrics.rankingScore),
      rankReason: isMeasured
        ? `${getViewDeltaLabel(period)} ${formatViewDelta(video.metrics.viewDelta)}（実測）`
        : "公開後平均再生速度から推定",
      heroLabel: heroMetric.label,
      heroValue: heroMetric.value,
      secondaryLabel: secondary?.label,
      secondaryValue: secondary?.value,
    });
  });
}

export function formatViewsPerHour(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }

  return value.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
}

export function mapMeasuredVideos(
  entries: SnapshotEnrichedVideo[],
  mapDisplay: (entry: SnapshotEnrichedVideo) => RankingDisplayInfo,
  sort: (left: SnapshotEnrichedVideo, right: SnapshotEnrichedVideo) => number,
): Video[] {
  return [...entries]
    .sort(sort)
    .slice(0, MAX_RANKING_RESULTS)
    .map((entry) =>
      attachDisplay(
        {
          ...entry.video,
          metrics: {
            ...entry.video.metrics,
            metricsSource: "measured",
            rankingScore: mapDisplay(entry).scoreValue ?? 0,
          },
        },
        mapDisplay(entry),
      ),
    );
}
