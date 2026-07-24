import { notFound } from "next/navigation";

import { VideoDetailView } from "@/components/video/VideoDetailView";
import { parseRankingPeriod } from "@/lib/ranking/metrics";
import { getVideoById } from "@/lib/youtube/rankings";

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}

export default async function VideoPage({ params, searchParams }: VideoPageProps) {
  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const period = parseRankingPeriod(periodParam);

  const video = await getVideoById(id, period);

  if (!video) {
    notFound();
  }

  return <VideoDetailView video={video} period={period} />;
}
