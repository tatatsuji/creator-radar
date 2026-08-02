export interface YouTubeOEmbedResponse {
  width?: number;
  height?: number;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export async function fetchYouTubeOEmbedVertical(
  videoId: string,
): Promise<boolean | null> {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as YouTubeOEmbedResponse;
    const width = data.thumbnail_width ?? data.width;
    const height = data.thumbnail_height ?? data.height;
    if (width == null || height == null || width <= 0 || height <= 0) {
      return null;
    }

    return height >= width;
  } catch {
    return null;
  }
}
