export interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YouTubeSearchItem {
  id: {
    videoId?: string;
  };
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

export interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description?: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    categoryId?: string;
    tags?: string[];
    liveBroadcastContent?: "none" | "live" | "upcoming";
    thumbnails: {
      maxres?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      default?: YouTubeThumbnail;
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

export interface YouTubeVideosResponse {
  items: YouTubeVideoItem[];
}

export interface YouTubeChannelItem {
  id: string;
  snippet: {
    title: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
    };
  };
  statistics?: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

export interface YouTubeChannelsResponse {
  items: YouTubeChannelItem[];
}
