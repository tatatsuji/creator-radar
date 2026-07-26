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

export function formatMeasuredValue(value: number | null | undefined): string {
  if (value == null) {
    return "データ蓄積中";
  }

  return formatCount(value);
}

const TOKYO_TIMEZONE = "Asia/Tokyo";

export function formatRankingUpdatedAt(
  isoString: string,
  now = new Date(),
): string {
  const updatedAt = new Date(isoString);

  const dateKeyFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const monthDayFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIMEZONE,
    month: "numeric",
    day: "numeric",
  });

  const updatedKey = dateKeyFormatter.format(updatedAt);
  const todayKey = dateKeyFormatter.format(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKeyFormatter.format(yesterday);
  const time = timeFormatter.format(updatedAt);

  if (updatedKey === todayKey) {
    return `今日 ${time} 更新`;
  }

  if (updatedKey === yesterdayKey) {
    return `昨日 ${time} 更新`;
  }

  return `${monthDayFormatter.format(updatedAt)} ${time} 更新`;
}

export function formatViewDelta(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${formatCount(value)}回`;
}

export function formatRelativePublishedAt(
  isoString: string,
  now = new Date(),
): string {
  const publishedAt = new Date(isoString);
  const diffMs = now.getTime() - publishedAt.getTime();
  const diffHours = Math.max(Math.floor(diffMs / (1000 * 60 * 60)), 0);

  if (diffHours < 24) {
    return `${Math.max(diffHours, 1)}時間前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${Math.max(diffDays, 1)}日前`;
}

export function formatHoursSincePublish(
  isoString: string,
  now = new Date(),
): string {
  const diffMs = now.getTime() - new Date(isoString).getTime();
  const diffHours = Math.max(Math.floor(diffMs / (1000 * 60 * 60)), 0);

  if (diffHours < 24) {
    return `公開から ${Math.max(diffHours, 1)}時間`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `公開から ${Math.max(diffDays, 1)}日`;
}

export function formatDurationSeconds(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return "—";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
  }

  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分`;
  }

  return `${remainingSeconds}秒`;
}

export const INSUFFICIENT_DATA_FOLLOWUP =
  "次回以降の定期取得で表示されます";

export function formatMeasuredVelocity(value: number | null | undefined): string {
  if (value == null) {
    return "データ蓄積中";
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万回/時`;
  }

  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}回/時`;
}

export function formatChartDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIMEZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(date);
}

export function formatChartTooltip(
  capturedAt: string,
  viewCount: number,
): string {
  return `${formatChartDateTime(capturedAt)} · ${formatCount(viewCount)}回`;
}

export function formatAccumulationProgress(input: {
  pointCount: number;
  oldestAt: string | null;
  newestAt: string | null;
}): string {
  if (input.pointCount <= 0) {
    return "計測データはまだありません";
  }

  if (input.pointCount === 1) {
    return "計測データ 1件 · 次回取得で推移が表示されます";
  }

  const oldest = input.oldestAt ? formatChartDateTime(input.oldestAt) : "—";
  const newest = input.newestAt ? formatChartDateTime(input.newestAt) : "—";

  return `計測データ ${input.pointCount}件 · ${oldest} 〜 ${newest}`;
}
