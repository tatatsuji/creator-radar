import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VideoDetailView } from "@/components/video/VideoDetailView";
import { getRankingAwarePageDescription } from "@/lib/video/detailContext";
import { parseHomeUrlState } from "@/lib/home/urlState";
import {
  buildVideoAnalysisInput,
  getRankingOptimizedAnalysis,
} from "@/lib/video/rankingAnalysis";
import { getVideoByIdFromDb } from "@/lib/videos/getVideoFromDb";

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; genre?: string; mode?: string; ranking?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: VideoPageProps): Promise<Metadata> {
  const { id } = await params;
  const query = await searchParams;
  const homeUrlState = parseHomeUrlState({
    get: (key) => query[key as keyof typeof query] ?? null,
  });
  const video = await getVideoByIdFromDb(id, homeUrlState.period);

  if (!video) {
    return {
      title: "動画が見つかりません",
    };
  }

  const title = video.title;
  const description = getRankingAwarePageDescription(video, homeUrlState.ranking);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: video.thumbnailUrl }],
      type: "video.other",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [video.thumbnailUrl],
    },
  };
}

export default async function VideoPage({ params, searchParams }: VideoPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const homeUrlState = parseHomeUrlState({
    get: (key) => query[key as keyof typeof query] ?? null,
  });

  const video = await getVideoByIdFromDb(id, homeUrlState.period);

  if (!video) {
    notFound();
  }

  const analysisInput = await buildVideoAnalysisInput(video, homeUrlState.period);
  const analysis = getRankingOptimizedAnalysis(
    analysisInput,
    homeUrlState.ranking,
  );

  return (
    <VideoDetailView
      video={video}
      period={homeUrlState.period}
      homeUrlState={homeUrlState}
      analysis={analysis}
    />
  );
}
