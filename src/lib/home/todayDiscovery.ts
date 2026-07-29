import { getCardTrendInsight } from "@/lib/ranking/cardDisplay";
import { getRankingsPayload } from "@/lib/ranking/getRankingsPayload";
import {
  HOME_UI_RANKING_LABELS,
  HOME_UI_RANKING_ONE_LINERS,
} from "@/lib/ranking/rankingMeta";
import { matchesContentFormatFilter } from "@/lib/home/contentFormat";
import type { Video } from "@/types";
import type { HomeUiRankingType } from "@/types/ranking";

const TOKYO_TIMEZONE = "Asia/Tokyo";

export interface TodayDiscoveryItem {
  id: string;
  ranking: HomeUiRankingType | "shorts" | "live";
  rankingLabel: string;
  roleLabel: string;
  video: Video;
  insight: string;
}

export interface TodayDiscoveryPayload {
  dateLabel: string;
  dataFreshnessAt: string | null;
  items: TodayDiscoveryItem[];
  summary: string;
}

function formatTodayDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
}

function pickTopVideo(
  videos: Video[],
  filter?: "short" | "live",
): Video | null {
  const eligible = filter
    ? videos.filter((video) => matchesContentFormatFilter(video.contentKind, filter))
    : videos;

  return eligible[0] ?? null;
}

function buildRankingItem(
  ranking: HomeUiRankingType,
  video: Video,
): TodayDiscoveryItem {
  return {
    id: `${ranking}-${video.id}`,
    ranking,
    rankingLabel: HOME_UI_RANKING_LABELS[ranking],
    roleLabel: HOME_UI_RANKING_ONE_LINERS[ranking],
    video,
    insight: getCardTrendInsight(video, ranking, "24h"),
  };
}

function buildFormatItem(
  format: "shorts" | "live",
  video: Video,
): TodayDiscoveryItem {
  const labels = {
    shorts: { rankingLabel: "Shorts", roleLabel: "短尺で今伸びている動画" },
    live: { rankingLabel: "ライブ", roleLabel: "配信中・急上昇のライブ" },
  } as const;

  return {
    id: `${format}-${video.id}`,
    ranking: format,
    rankingLabel: labels[format].rankingLabel,
    roleLabel: labels[format].roleLabel,
    video,
    insight: getCardTrendInsight(video, "buzz", "24h"),
  };
}

function buildSummary(items: TodayDiscoveryItem[]): string {
  if (items.length === 0) {
    return "計測データを集計中です。しばらくしてから再度ご確認ください。";
  }

  const labels = items.map((item) => item.rankingLabel);
  const unique = [...new Set(labels)];

  return `今日の注目は${unique.join("・")}。気になる1本から詳細を確認できます。`;
}

function latestFreshness(timestamps: Array<string | null>): string | null {
  const valid = timestamps.filter((value): value is string => Boolean(value));
  if (valid.length === 0) {
    return null;
  }

  return valid.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

export async function getTodayDiscoveryPayload(): Promise<TodayDiscoveryPayload> {
  const [buzz, earlyRise] = await Promise.all([
    getRankingsPayload("buzz", "24h", "all"),
    getRankingsPayload("early_rise", "24h", "all"),
  ]);

  const items: TodayDiscoveryItem[] = [];

  const buzzTop = pickTopVideo(buzz.videos);
  if (buzzTop) {
    items.push(buildRankingItem("buzz", buzzTop));
  }

  const earlyTop =
    earlyRise.readiness.status === "ready"
      ? pickTopVideo(earlyRise.videos)
      : null;
  if (earlyTop) {
    items.push(buildRankingItem("early_rise", earlyTop));
  }

  const shortsTop = pickTopVideo(buzz.videos, "short");
  if (shortsTop && !items.some((item) => item.video.id === shortsTop.id)) {
    items.push(buildFormatItem("shorts", shortsTop));
  }

  const liveTop = pickTopVideo(buzz.videos, "live");
  if (liveTop && !items.some((item) => item.video.id === liveTop.id)) {
    items.push(buildFormatItem("live", liveTop));
  }

  return {
    dateLabel: formatTodayDateLabel(),
    dataFreshnessAt: latestFreshness([
      buzz.dataFreshnessAt,
      earlyRise.dataFreshnessAt,
    ]),
    items: items.slice(0, 4),
    summary: buildSummary(items),
  };
}

export function buildTodayDiscoveryFromVideos(input: {
  buzz: Video[];
  earlyRise?: Video[];
  dataFreshnessAt?: string | null;
}): TodayDiscoveryPayload {
  const items: TodayDiscoveryItem[] = [];
  const buzzTop = pickTopVideo(input.buzz);

  if (buzzTop) {
    items.push(buildRankingItem("buzz", buzzTop));
  }

  const earlyTop = input.earlyRise ? pickTopVideo(input.earlyRise) : null;
  if (earlyTop) {
    items.push(buildRankingItem("early_rise", earlyTop));
  }

  const shortsTop = pickTopVideo(input.buzz, "short");
  if (shortsTop) {
    items.push(buildFormatItem("shorts", shortsTop));
  }

  return {
    dateLabel: formatTodayDateLabel(),
    dataFreshnessAt: input.dataFreshnessAt ?? null,
    items,
    summary: buildSummary(items),
  };
}
