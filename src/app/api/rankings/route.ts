import { NextRequest, NextResponse } from "next/server";

import { parseRankingType } from "@/lib/home/rankingType";
import { getRankingsPayload } from "@/lib/ranking/getRankingsPayload";
import { parseRankingPeriod } from "@/lib/ranking/periods";
import {
  getAvailableGenreIds,
  getRankingErrorMessage,
} from "@/lib/youtube/rankings";
import type { GenreId } from "@/types";

const GENRES: GenreId[] = [
  "all",
  "shorts",
  "entertainment",
  "music",
  "game",
  "education",
  "news",
  "howto",
  "sports",
  "other",
];

function parseGenre(value: string | null): GenreId {
  if (value && GENRES.includes(value as GenreId)) {
    return value as GenreId;
  }

  return "all";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ranking = parseRankingType(
    searchParams.get("ranking"),
    searchParams.get("mode"),
  );
  const period = parseRankingPeriod(searchParams.get("period"));
  const genre = parseGenre(searchParams.get("genre"));
  const availableGenres = await getAvailableGenreIds();

  if (genre !== "all" && !availableGenres.includes(genre)) {
    return NextResponse.json({
      ranking,
      period,
      genre,
      videos: [],
      availableGenres,
      updatedAt: new Date().toISOString(),
      total: 0,
      metricsSummary: { measured: 0, estimated: 0 },
      readiness: {
        status: "ready",
        eligibleCount: 0,
        requiredCount: 0,
        message: "",
      },
    });
  }

  try {
    const payload = await getRankingsPayload(ranking, period, genre);

    return NextResponse.json({
      ranking: payload.ranking,
      period,
      genre,
      videos: payload.videos,
      availableGenres,
      updatedAt: payload.updatedAt,
      dataFreshnessAt: payload.dataFreshnessAt,
      total: payload.videos.length,
      metricsSummary: payload.metricsSummary,
      readiness: payload.readiness,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getRankingErrorMessage(error), availableGenres },
      { status: 500 },
    );
  }
}
