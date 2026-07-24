export function getYouTubeApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY が設定されていません。.env.local に API キーを追加してください。",
    );
  }

  return apiKey;
}
