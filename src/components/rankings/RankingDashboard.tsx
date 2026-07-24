"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { VideoCard } from "@/components/rankings/VideoCard";
import { GenreFilter } from "@/components/ui/GenreFilter";
import { PeriodTabs } from "@/components/ui/PeriodTabs";
import { SearchBar } from "@/components/ui/SearchBar";
import type { GenreId, RankingPeriod, Video } from "@/types";

interface RankingDashboardProps {
  initialVideos: Video[];
  initialPeriod?: RankingPeriod;
  initialGenre?: GenreId;
  initialError?: string | null;
}

export function RankingDashboard({
  initialVideos,
  initialPeriod = "24h",
  initialGenre = "all",
  initialError = null,
}: RankingDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState<RankingPeriod>(initialPeriod);
  const [genre, setGenre] = useState<GenreId>(initialGenre);
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const skipInitialFetch = useRef(
    (initialVideos.length > 0 || Boolean(initialError)) &&
      period === initialPeriod &&
      genre === initialGenre,
  );

  useEffect(() => {
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
          `/api/rankings?period=${period}&genre=${genre}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          videos?: Video[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "ランキングデータの取得に失敗しました。");
        }

        setVideos(data.videos ?? []);
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
  }, [period, genre]);

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

  return (
    <div className="app-background min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
                  Creator Radar
                </p>
                <h1 className="text-lg font-semibold text-zinc-100">
                  急上昇動画ランキング
                </h1>
              </div>
            </div>

            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">
        <section className="mb-12 space-y-4">
          <h2 className="text-4xl font-bold tracking-tight text-gradient sm:text-5xl">
            Creator Radar
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-400">
            今、伸びている動画がすぐわかる。日本のYouTubeで急上昇中の動画を、期間・ジャンル別に探索できます。
          </p>
        </section>

        <section className="mb-10 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <PeriodTabs value={period} onChange={setPeriod} />
            <p className="text-sm text-zinc-500">
              {loading
                ? "読み込み中..."
                : `${filteredVideos.length}件の動画を表示中`}
            </p>
          </div>

          <GenreFilter value={genre} onChange={setGenre} />
        </section>

        {error ? (
          <div className="glass-panel border-red-500/20 bg-red-500/5 px-8 py-10 text-center">
            <p className="text-lg font-medium text-red-200">
              データの取得に失敗しました
            </p>
            <p className="mt-2 text-sm text-red-300/80">{error}</p>
            <p className="mt-4 text-sm text-zinc-500">
              `.env.local` に `YOUTUBE_API_KEY` を設定し、開発サーバーを再起動してください。
            </p>
          </div>
        ) : null}

        {loading ? (
          <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <li
                key={index}
                className="glass-card h-[420px] animate-pulse bg-white/[0.03]"
              />
            ))}
          </ul>
        ) : null}

        {!loading && !error && filteredVideos.length > 0 ? (
          <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVideos.map((video, index) => (
              <li key={video.id}>
                <VideoCard video={video} rank={index + 1} period={period} />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && filteredVideos.length === 0 ? (
          <div className="glass-panel flex flex-col items-center justify-center px-8 py-20 text-center">
            <p className="text-lg font-medium text-zinc-300">
              条件に一致する動画がありません
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              検索キーワードやジャンルを変更してみてください
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
