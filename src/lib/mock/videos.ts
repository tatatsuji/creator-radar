import type { Video } from "@/types";

const PLACEHOLDER_THUMBNAIL = "/placeholder-thumbnail.svg";

export const mockVideos: Video[] = [
  {
    id: "mock-video-001",
    title: "【初挑戦】自宅キッチンで本格ラーメンを作ってみた",
    description: "架空の料理チャンネルでのラーメン作り動画です。",
    thumbnailUrl: PLACEHOLDER_THUMBNAIL,
    publishedAt: "2026-07-20T10:00:00+09:00",
    channel: {
      id: "mock-channel-001",
      name: "のんびり台所ログ",
      subscriberCount: 12500,
    },
    viewCount: 284000,
    metrics: {
      period: "24h",
      viewDelta: 52000,
      viewVelocity: 2167,
      viewsPerSubscriber: 22.7,
      rankingScore: 92.4,
    },
  },
  {
    id: "mock-video-002",
    title: "放置系RPGを24時間プレイしたら世界記録に近づいた",
    thumbnailUrl: PLACEHOLDER_THUMBNAIL,
    publishedAt: "2026-07-19T18:30:00+09:00",
    channel: {
      id: "mock-channel-002",
      name: "ネコノゲーム部屋",
      subscriberCount: 89000,
    },
    viewCount: 512000,
    metrics: {
      period: "24h",
      viewDelta: 98000,
      viewVelocity: 4083,
      viewsPerSubscriber: 5.8,
      rankingScore: 88.1,
    },
  },
  {
    id: "mock-video-003",
    title: "【3分でわかる】梅雨時期のカビ対策5選",
    thumbnailUrl: PLACEHOLDER_THUMBNAIL,
    publishedAt: "2026-07-21T08:00:00+09:00",
    channel: {
      id: "mock-channel-003",
      name: "暮らしハック研究所",
      subscriberCount: 342000,
    },
    viewCount: 156000,
    metrics: {
      period: "24h",
      viewDelta: 41000,
      viewVelocity: 1708,
      viewsPerSubscriber: 0.46,
      rankingScore: 76.5,
    },
  },
  {
    id: "mock-video-004",
    title: "オリジナル曲「夜明けの信号」を公開しました",
    thumbnailUrl: PLACEHOLDER_THUMBNAIL,
    publishedAt: "2026-07-18T21:00:00+09:00",
    channel: {
      id: "mock-channel-004",
      name: "星屑サウンドラボ",
      subscriberCount: 15800,
    },
    viewCount: 93000,
    metrics: {
      period: "24h",
      viewDelta: 28000,
      viewVelocity: 1167,
      viewsPerSubscriber: 5.9,
      rankingScore: 81.2,
    },
  },
  {
    id: "mock-video-005",
    title: "地方駅前を1日歩いてみたら意外な発見があった",
    thumbnailUrl: PLACEHOLDER_THUMBNAIL,
    publishedAt: "2026-07-17T14:15:00+09:00",
    channel: {
      id: "mock-channel-005",
      name: "ローカル散歩チャンネル",
      subscriberCount: 42100,
    },
    viewCount: 198000,
    metrics: {
      period: "24h",
      viewDelta: 36000,
      viewVelocity: 1500,
      viewsPerSubscriber: 4.7,
      rankingScore: 79.8,
    },
  },
];
