import { getYouTubeApiKey } from "@/lib/youtube/config";

interface YouTubeApiError {
  error?: {
    message?: string;
  };
}

export async function youtubeFetch<T>(
  path: string,
  params: Record<string, string>,
  revalidate = 300,
): Promise<T> {
  const apiKey = getYouTubeApiKey();
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    next: { revalidate },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as YouTubeApiError;
    throw new Error(
      body.error?.message ?? `YouTube API request failed (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}
