"use client";

import { useEffect, useMemo, useSyncExternalStore, useState } from "react";

import { StatePanel } from "@/components/ui/StatePanel";
import { VideoViewsChart } from "@/components/video/VideoViewsChart";
import {
  formatMeasuredValue,
  formatMeasuredVelocity,
  formatRankingUpdatedAt,
  INSUFFICIENT_DATA_FOLLOWUP,
} from "@/lib/format";
import { MEASURED_METRICS_EXPLANATION } from "@/lib/video/detailDisplay";
import type { HistoryRange } from "@/lib/snapshots/deltaWindows";
import type {
  VideoDeltaEntry,
  VideoDeltasResponse,
} from "@/lib/snapshots/getVideoDeltas";
import type { VideoHistoryResponse } from "@/lib/snapshots/getVideoHistory";

const HISTORY_TABS: Array<{ id: HistoryRange; label: string }> = [
  { id: "24h", label: "24時間" },
  { id: "7d", label: "7日" },
  { id: "30d", label: "30日" },
];

interface VideoMeasuredPanelProps {
  videoId: string;
}

function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function VideoMeasuredPanel({ videoId }: VideoMeasuredPanelProps) {
  const mounted = useHasMounted();
  const [deltas, setDeltas] = useState<VideoDeltasResponse | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("24h");
  const [history, setHistory] = useState<VideoHistoryResponse | null>(null);
  const [loadingDeltas, setLoadingDeltas] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const controller = new AbortController();

    async function loadDeltas() {
      setLoadingDeltas(true);
      setError(null);

      try {
        const response = await fetch(`/api/videos/${videoId}/deltas`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as VideoDeltasResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "増加数データの取得に失敗しました。");
        }

        setDeltas(data);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "増加数データの取得に失敗しました。",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDeltas(false);
        }
      }
    }

    void loadDeltas();
    return () => controller.abort();
  }, [videoId, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const controller = new AbortController();

    async function loadHistory() {
      setLoadingHistory(true);

      try {
        const response = await fetch(
          `/api/videos/${videoId}/history?range=${historyRange}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as VideoHistoryResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "履歴データの取得に失敗しました。");
        }

        setHistory(data);
      } catch {
        if (!controller.signal.aborted) {
          setHistory(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingHistory(false);
        }
      }
    }

    void loadHistory();
    return () => controller.abort();
  }, [videoId, historyRange, mounted]);

  const deltaMap = useMemo(() => {
    const map = new Map<string, VideoDeltaEntry>();
    for (const entry of deltas?.deltas ?? []) {
      map.set(entry.window, entry);
    }
    return map;
  }, [deltas]);

  const loading = loadingDeltas || !mounted;
  const hasAnyMeasured = (deltas?.deltas ?? []).some(
    (entry) => entry.status === "measured",
  );

  return (
    <section
      className="glass-panel space-y-5 p-4 sm:p-6"
      aria-labelledby="measured-panel-heading"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
          実測データ
        </p>
        <h2 id="measured-panel-heading" className="mt-1 text-lg font-semibold text-zinc-100">
          計測データで見る伸び方
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {MEASURED_METRICS_EXPLANATION}。Creator Radarが継続計測した結果を、時間軸で確認できます。
        </p>
        {deltas?.measuredAt ? (
          <p className="mt-2 text-xs text-zinc-500">
            最終取得 {formatRankingUpdatedAt(deltas.measuredAt)}
          </p>
        ) : null}
      </div>

      {error ? (
        <StatePanel
          tone="error"
          title="実測データを読み込めませんでした"
          description="しばらくしてから再度お試しください。上部の分析サマリーは引き続き参照できます。"
        />
      ) : null}

      {!error && !loading && deltas?.source === "insufficient" ? (
        <StatePanel
          tone="empty"
          title="計測データを準備中です"
          description={`まだ十分なデータがありません。${INSUFFICIENT_DATA_FOLLOWUP}`}
        />
      ) : null}

      {!error && (loading || hasAnyMeasured || deltas?.source === "measured") ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MeasuredMetric
              label="1時間増加"
              value={formatMeasuredDelta(deltaMap.get("1h"), loading)}
              loading={loading}
            />
            <MeasuredMetric
              label="3時間増加"
              value={formatMeasuredDelta(deltaMap.get("3h"), loading)}
              loading={loading}
            />
            <MeasuredMetric
              label="24時間増加"
              value={formatMeasuredDelta(deltaMap.get("24h"), loading)}
              loading={loading}
            />
            <MeasuredMetric
              label="7日増加"
              value={formatMeasuredDelta(deltaMap.get("7d"), loading)}
              loading={loading}
              optional
            />
            <MeasuredMetric
              label="30日増加"
              value={formatMeasuredDelta(deltaMap.get("30d"), loading)}
              loading={loading}
              optional
            />
            <MeasuredMetric
              label="24時間速度"
              value={formatMeasuredVelocity(
                deltaMap.get("24h")?.status === "measured"
                  ? deltaMap.get("24h")?.viewVelocity
                  : null,
              )}
              loading={loading}
              accent
            />
          </div>

          {!loading && hasAnyMeasured ? (
            <p className="text-xs text-zinc-500">
              利用できない期間は「データ不足」と表示されます。計測が進むと順次表示されます。
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">再生数の推移</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  スナップショット間の変化をグラフで表示します。
                </p>
              </div>
              <div className="-mx-1 overflow-x-auto scroll-tabs px-1">
                <div
                  className="glass-panel inline-flex min-w-max gap-1 p-1"
                  role="tablist"
                  aria-label="グラフ表示期間"
                >
                  {HISTORY_TABS.map((tab) => {
                    const isActive = historyRange === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setHistoryRange(tab.id)}
                        className={`min-h-10 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <VideoViewsChart history={history} loading={loadingHistory || !mounted} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function formatMeasuredDelta(
  entry: VideoDeltaEntry | undefined,
  loading: boolean,
): string {
  if (loading) {
    return "読み込み中...";
  }

  if (entry?.status !== "measured" || entry.viewDelta == null) {
    return "データ不足";
  }

  return `${formatMeasuredValue(entry.viewDelta)}回`;
}

function MeasuredMetric({
  label,
  value,
  loading,
  accent = false,
  optional = false,
}: {
  label: string;
  value: string;
  loading?: boolean;
  accent?: boolean;
  optional?: boolean;
}) {
  const isUnavailable =
    !loading && (value === "データ不足" || value === "データ蓄積中");

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      {isUnavailable ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-medium text-zinc-400">
            {optional ? "データ不足" : "準備中"}
          </p>
          {!optional ? (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {INSUFFICIENT_DATA_FOLLOWUP}
            </p>
          ) : null}
        </div>
      ) : (
        <p
          className={`mt-2 text-base font-semibold tabular-nums sm:text-lg ${
            accent ? "text-violet-300" : "text-zinc-100"
          } ${loading ? "animate-pulse text-zinc-500" : ""}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
