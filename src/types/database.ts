export interface VideoSnapshotRow {
  id: string;
  video_id: string;
  view_count: number;
  like_count: number | null;
  comment_count: number | null;
  captured_at: string;
}

export interface VideoRow {
  youtube_video_id: string;
  title: string | null;
  channel_id: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  category_id: string | null;
  updated_at: string;
}

export interface UpsertVideoInput {
  youtubeVideoId: string;
  title: string;
  channelId: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
  categoryId?: string;
}

export interface InsertSnapshotInput {
  videoId: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  capturedAt?: string;
}
