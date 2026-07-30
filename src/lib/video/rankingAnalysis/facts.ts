import { formatDurationSeconds, formatViewDelta } from "@/lib/format";
import { getVelocityDisplay } from "@/lib/ranking/metrics";
import { getPeriodLabel, getViewDeltaLabel } from "@/lib/ranking/periods";
import type { PromotionMetrics } from "@/lib/promotion/metrics";
import type { Video } from "@/types";
import type { RankingPeriod } from "@/types";

import type { AnalysisFact, VideoEngagementStats } from "./types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function getJstParts(iso: string): { weekday: string; hour: number } {
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return {
    weekday: WEEKDAY_LABELS[jst.getUTCDay()] ?? "日",
    hour: jst.getUTCHours(),
  };
}

function formatRate(value: number | null, suffix: string): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return `${(value * 100).toFixed(2)}${suffix}`;
}

export function buildEngagementStats(
  viewCount: number,
  likeCount: number | null | undefined,
  commentCount: number | null | undefined,
): VideoEngagementStats {
  const likes = likeCount ?? null;
  const comments = commentCount ?? null;

  const likeRate =
    likes != null && viewCount > 0 ? likes / viewCount : null;
  const commentRate =
    comments != null && viewCount > 0 ? comments / viewCount : null;

  return {
    likeCount: likes,
    commentCount: comments,
    likeRate,
    commentRate,
  };
}

export function buildAnalysisFacts(input: {
  video: Video;
  period: RankingPeriod;
  engagement: VideoEngagementStats;
  promotionMetrics: PromotionMetrics | null;
}): AnalysisFact[] {
  const { video, period, engagement, promotionMetrics } = input;
  const facts: AnalysisFact[] = [];

  const titleLength = [...video.title.trim()].length;
  facts.push({
    id: "title",
    label: "タイトル",
    value: `${titleLength}文字 · ${video.title.trim().slice(0, 36)}${video.title.length > 36 ? "…" : ""}`,
  });

  if (video.durationSeconds != null) {
    facts.push({
      id: "duration",
      label: "動画時間",
      value: formatDurationSeconds(video.durationSeconds),
    });
  }

  const { weekday, hour } = getJstParts(video.publishedAt);
  facts.push({
    id: "published",
    label: "投稿時間",
    value: `${weekday}曜 ${String(hour).padStart(2, "0")}:00頃（JST）`,
  });

  const likeRate = formatRate(engagement.likeRate, "%");
  if (likeRate) {
    facts.push({ id: "like_rate", label: "いいね率", value: likeRate });
  }

  const commentRate = formatRate(engagement.commentRate, "%");
  if (commentRate) {
    facts.push({ id: "comment_rate", label: "コメント率", value: commentRate });
  }

  if (!video.channel.subscriberCountHidden && video.channel.subscriberCount > 0) {
    facts.push({
      id: "views_per_sub",
      label: "登録者比",
      value: `${video.metrics.viewsPerSubscriber.toFixed(1)}倍`,
    });
  }

  const velocity = getVelocityDisplay(video, period);
  facts.push({
    id: "velocity",
    label: "再生速度",
    value: `${velocity.value}${velocity.unit}（${getPeriodLabel(period)}）`,
  });

  if (video.metrics.viewDelta > 0) {
    facts.push({
      id: "view_delta",
      label: getViewDeltaLabel(period),
      value: formatViewDelta(video.metrics.viewDelta),
    });
  }

  if (promotionMetrics?.acceleration != null) {
    const sign = promotionMetrics.acceleration >= 0 ? "+" : "";
    facts.push({
      id: "acceleration",
      label: "加速度",
      value: `${sign}${(promotionMetrics.acceleration * 100).toFixed(0)}%`,
    });
  }

  return facts;
}
