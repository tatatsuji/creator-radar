export function parseIsoDurationSeconds(isoDuration?: string): number {
  if (!isoDuration) {
    return 0;
  }

  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/** YouTube Shorts are typically 60 seconds or less. */
export function isShortFormVideo(durationSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds <= 60;
}
