export function formatCount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  return value.toLocaleString("ja-JP");
}

export function formatSubscriberCount(
  count: number,
  hidden?: boolean,
): string {
  if (hidden) {
    return "非公開";
  }

  return `${formatCount(count)}人`;
}

export function formatViewsPerSubscriber(
  ratio: number,
  hidden?: boolean,
): string {
  if (hidden || ratio <= 0) {
    return "—";
  }

  return `${ratio.toFixed(1)}x`;
}
