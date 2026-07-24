import { RankingDashboard } from "@/components/rankings/RankingDashboard";
import {
  getRankingErrorMessage,
  getRankings,
} from "@/lib/youtube/rankings";
import type { Video } from "@/types";

export default async function Home() {
  let initialVideos: Video[] = [];
  let initialError: string | null = null;

  try {
    initialVideos = await getRankings("24h", "all");
  } catch (error) {
    initialError = getRankingErrorMessage(error);
  }

  return (
    <RankingDashboard
      initialVideos={initialVideos}
      initialPeriod="24h"
      initialGenre="all"
      initialError={initialError}
    />
  );
}
