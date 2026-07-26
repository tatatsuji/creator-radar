"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DataAccumulatingPanel } from "@/components/home/DataAccumulatingPanel";
import { MetricsCoverageBanner } from "@/components/rankings/MetricsCoverageBanner";
import { VideoCard } from "@/components/rankings/VideoCard";
import { GenreFilter } from "@/components/ui/GenreFilter";
import { PeriodTabs } from "@/components/ui/PeriodTabs";
import { RankingCardSkeleton, StatePanel } from "@/components/ui/StatePanel";
import { formatRankingUpdatedAt } from "@/lib/format";
import type { HomeUrlState } from "@/lib/home/urlState";
import {
  RANKING_TYPE_DESCRIPTIONS,
  RANKING_TYPE_TITLES,
} from "@/lib/ranking/rankingMeta";
import { getPeriodLabel } from "@/lib/ranking/periods";
import type { GenreId, RankingPeriod, Video } from "@/types";
import type { RankingReadiness, RankingType } from "@/types/ranking";

interface RankingPanelProps {
  active: boolean;
  ranking: RankingType;
  searchQuery: string;
  period: RankingPeriod;
  genre: GenreId;
  homeUrlState: HomeUrlState;
  onPeriodChange: (period: RankingPeriod) => void;
  onGenreChange: (genre: GenreId) => void;
  onViewBuzz?: () => void;
  initialVideos: Video[];
  initialPeriod: RankingPeriod;
  initialGenre: GenreId;
  initialUpdatedAt?: string;
  initialDataFreshnessAt?: string | null;
  initialMetricsSummary?: { measured: number; estimated: number };
  initialReadiness?: RankingReadiness;
  initialAvailableGenres?: GenreId[];
  initialError?: string | null;
}

export function RankingPanel({
  active,
  ranking,
  searchQuery,
  period,
  genre,
  homeUrlState,
  onPeriodChange,
  onGenreChange,
  onViewBuzz,
  initialVideos,
  initialPeriod,
  initialGenre,
  initialUpdatedAt,
  initialDataFreshnessAt = null,
  initialMetricsSummary = { measured: 0, estimated: 0 },
  initialReadiness = {
    status: "ready",
    eligibleCount: 0,
    requiredCount: 0,
    message: "",
  },
  initialAvailableGenres = ["all"],
  initialError = null,
}: RankingPanelProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [readiness, setReadiness] = useState<RankingReadiness>(initialReadiness);
  const [availableGenres, setAvailableGenres] = useState<GenreId[]>(
    initialAvailableGenres,
  );
  const [updatedAt, setUpdatedAt] = useState<string>(
    initialUpdatedAt ?? new Date().toISOString(),
  );
  const [dataFreshnessAt, setDataFreshnessAt] = useState<string | null>(
    initialDataFreshnessAt,
  );
  const [metricsSummary, setMetricsSummary] = useState(initialMetricsSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const skipInitialFetch = useRef(
    (initialVideos.length > 0 ||
      initialReadiness.status === "accumulating" ||
      Boolean(initialError)) &&
      ranking === homeUrlState.ranking &&
      period === initialPeriod &&
      genre === initialGenre,
  );

  const isSearching = searchQuery.trim().length > 0;
  const isAccumulating = readiness.status === "accumulating";

  useEffect(() => {
    if (!active) {
      return;
    }

    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    const controller = new AbortController();

    async function loadRankings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/rankings?ranking=${ranking}&period=${period}&genre=${genre}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          videos?: Video[];
          updatedAt?: string;
          dataFreshnessAt?: string | null;
          metricsSummary?: { measured: number; estimated: number };
          availableGenres?: GenreId[];
          readiness?: RankingReadiness;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "ランキングデータの取得に失敗しました。");
        }

        setVideos(data.videos ?? []);
        if (data.readiness) {
          setReadiness(data.readiness);
        }
        if (data.availableGenres?.length) {
          setAvailableGenres(data.availableGenres);
          if (!data.availableGenres.includes(genre)) {
            onGenreChange("all");
          }
        }
        if (data.updatedAt) {
          setUpdatedAt(data.updatedAt);
        }
        if ("dataFreshnessAt" in data) {
          setDataFreshnessAt(data.dataFreshnessAt ?? null);
        }
        if (data.metricsSummary) {
          setMetricsSummary(data.metricsSummary);
        }
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setVideos([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "ランキングデータの取得に失敗しました。",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadRankings();

    return () => controller.abort();
  }, [active, genre, onGenreChange, period, ranking]);

  const filteredVideos = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return videos;
    }

    return videos.filter(
      (video) =>
        video.title.toLowerCase().includes(normalizedQuery) ||
        video.channel.name.toLowerCase().includes(normalizedQuery),
    );
  }, [videos, searchQuery]);

  const statusLine = loading
    ? "読み込み中..."
    : `${formatRankingUpdatedAt(dataFreshnessAt ?? updatedAt)} · ${getPeriodLabel(period)} · ${filteredVideos.length}件`;

  if (!loading && !error && isAccumulating) {
    return (
      <section
        id={`home-ranking-panel-${ranking}`}
        role="tabpanel"
        aria-labelledby={`home-ranking-tab-${ranking}`}
      >
        <DataAccumulatingPanel
          title={RANKING_TYPE_TITLES[ranking]}
          description={RANKING_TYPE_DESCRIPTIONS[ranking]}
          readiness={readiness}
          onViewBuzz={onViewBuzz}
        />
      </section>
    );
  }

  return (
    <section
      id={`home-ranking-panel-${ranking}`}
      role="tabpanel"
      aria-labelledby={`home-ranking-tab-${ranking}`}
      className="space-y-6"
    >
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-50 sm:text-2xl">
          {RANKING_TYPE_TITLES[ranking]}
        </h2>
        <p className="text-sm text-zinc-400 sm:text-base">
          {RANKING_TYPE_DESCRIPTIONS[ranking]}
        </p>
        <p className="text-sm text-zinc-500">{statusLine}</p>
      </div>

      <PeriodTabs value={period} onChange={onPeriodChange} />

      <div className="space-y-3">
        {!loading && !error && ranking === "buzz" ? (
          <MetricsCoverageBanner
            measured={metricsSummary.measured}
            estimated={metricsSummary.estimated}
            total={videos.length}
            updatedAt={updatedAt}
            dataFreshnessAt={dataFreshnessAt}
          />
        ) : null}
        <GenreFilter
          value={genre}
          availableGenres={availableGenres}
          onChange={onGenreChange}
        />
      </div>

      {error ? (
        <StatePanel
          tone="error"
          title="ランキングを読み込めませんでした"
          description="通信状況を確認して、時間をおいて再度お試しください。"
        />
      ) : null}

      {loading ? (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index}>
              <RankingCardSkeleton />
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !error && filteredVideos.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {filteredVideos.map((video, index) => (
            <li key={video.id}>
              <VideoCard
                video={video}
                rank={index + 1}
                period={period}
                ranking={ranking}
                homeUrlState={homeUrlState}
                isSearchResult={isSearching}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !error && filteredVideos.length === 0 ? (
        <StatePanel
          tone="empty"
          title={
            isSearching
              ? "一致する動画がありません"
              : videos.length === 0
                ? "この条件では動画がありません"
                : "検索結果がありません"
          }
          description={
            isSearching
              ? "別のキーワードを試すか、検索をクリアしてください。"
              : "期間やジャンルを変更して、再度お試しください。"
          }
        />
      ) : null}
    </section>
  );
}
