import { NextRequest, NextResponse } from "next/server";

import {
  getRankingErrorMessage,
  getRankings,
} from "@/lib/youtube/rankings";
import { getSnapshotMetricsSummary } from "@/lib/ranking/snapshotMetrics";
import type { GenreId, RankingPeriod } from "@/types";

const PERIODS: RankingPeriod[] = ["24h", "3d", "7d"];
const GENRES: GenreId[] = [
  "all",
  "entertainment",
  "music",
  "game",
  "education",
  "news",
  "howto",
  "sports",
  "other",
];

function parsePeriod(value: string | null): RankingPeriod {
  if (value && PERIODS.includes(value as RankingPeriod)) {
    return value as RankingPeriod;
  }

  return "24h";
}

function parseGenre(value: string | null): GenreId {
  if (value && GENRES.includes(value as GenreId)) {
    return value as GenreId;
  }

  return "all";
}

export async function GET(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const genre = parseGenre(request.nextUrl.searchParams.get("genre"));

  try {
    const videos = await getRankings(period, genre);

    return NextResponse.json({
      period,
      genre,
      videos,
      updatedAt: new Date().toISOString(),
      total: videos.length,
      metricsSummary: getSnapshotMetricsSummary(videos),
    });
  } catch (error) {
    return NextResponse.json(
      { error: getRankingErrorMessage(error) },
      { status: 500 },
    );
  }
}
