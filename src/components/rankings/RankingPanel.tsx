"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DataAccumulatingPanel } from "@/components/home/DataAccumulatingPanel";
import { MetricsCoverageBanner } from "@/components/rankings/MetricsCoverageBanner";
import { RankingFiltersBar } from "@/components/rankings/RankingFiltersBar";
import { RankingViewContextBanner } from "@/components/rankings/RankingViewContextBanner";
import { VideoCard } from "@/components/rankings/VideoCard";
import { RankingCardSkeleton, StatePanel } from "@/components/ui/StatePanel";
import { formatRankingUpdatedAt } from "@/lib/format";
import { matchesContentFormatFilter, type ContentFormatFilter } from "@/lib/home/contentFormat";
import type { HomeUrlState } from "@/lib/home/urlState";
import {
  BUZZ_INITIAL_DISPLAY_COUNT,
  RANKING_TYPE_DESCRIPTIONS,
  RANKING_TYPE_TITLES,
} from "@/lib/ranking/rankingMeta";
import { getPeriodHeadline, getPeriodLabel } from "@/lib/ranking/periods";
import type { GenreId, RankingPeriod, Video } from "@/types";
import type { RankingReadiness, RankingType } from "@/types/ranking";

interface RankingPanelProps {
  active: boolean;
  ranking: RankingType;
  searchQuery: string;
  period: RankingPeriod;
  genre: GenreId;
  format: ContentFormatFilter;
  homeUrlState: HomeUrlState;
  onPeriodChange: (period: RankingPeriod) => void;
  onGenreChange: (genre: GenreId) => void;
  onFormatChange: (format: ContentFormatFilter) => void;
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
  format,
  homeUrlState,
  onPeriodChange,
  onGenreChange,
  onFormatChange,
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
  const [expandedBuzzKeys, setExpandedBuzzKeys] = useState<Set<string>>(new Set());
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
  const buzzViewKey = `${ranking}:${period}:${genre}`;
  const showAllBuzz = expandedBuzzKeys.has(buzzViewKey);

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

    return videos.filter((video) => {
      if (!matchesContentFormatFilter(video.contentKind, format)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        video.title.toLowerCase().includes(normalizedQuery) ||
        video.channel.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [videos, searchQuery, format]);

  const visibleVideos = useMemo(() => {
    if (ranking !== "buzz" || showAllBuzz || isSearching) {
      return filteredVideos;
    }

    return filteredVideos.slice(0, BUZZ_INITIAL_DISPLAY_COUNT);
  }, [filteredVideos, isSearching, ranking, showAllBuzz]);

  const canExpandBuzz =
    ranking === "buzz" &&
    !isSearching &&
    filteredVideos.length > BUZZ_INITIAL_DISPLAY_COUNT &&
    !showAllBuzz;

  const showViewContext =
    homeUrlState.format !== "all" || homeUrlState.genre !== "all";

  const panelTitle =
    period === "24h" &&
    homeUrlState.format === "all" &&
    homeUrlState.genre === "all"
      ? getPeriodHeadline(period)
      : RANKING_TYPE_TITLES[ranking];

  const statusLine = loading
    ? "読み込み中..."
    : `${formatRankingUpdatedAt(dataFreshnessAt ?? updatedAt)} · ${getPeriodLabel(period)} · ${filteredVideos.length}件${ranking === "buzz" && visibleVideos.length < filteredVideos.length ? `（${visibleVideos.length}件表示）` : ""}`;

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
          {panelTitle}
        </h2>
        <p className="text-sm text-zinc-400 sm:text-base">
          {RANKING_TYPE_DESCRIPTIONS[ranking]}
        </p>
        <p className="text-sm text-zinc-500">{statusLine}</p>
      </div>

      {showViewContext ? (
        <RankingViewContextBanner homeUrlState={homeUrlState} ranking={ranking} />
      ) : null}

      <RankingFiltersBar
        period={period}
        genre={genre}
        format={format}
        availableGenres={availableGenres}
        onPeriodChange={onPeriodChange}
        onGenreChange={onGenreChange}
        onFormatChange={onFormatChange}
      />

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

      {!loading && !error && visibleVideos.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 xl:gap-6">
          {visibleVideos.map((video, index) => (
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

      {canExpandBuzz ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() =>
              setExpandedBuzzKeys((current) => new Set(current).add(buzzViewKey))
            }
            className="rounded-full border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            もっと見る（最大{filteredVideos.length}件）
          </button>
        </div>
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
              : "期間・ジャンル・動画形式を変更して、再度お試しください。"
          }
        />
      ) : null}
    </section>
  );
}
