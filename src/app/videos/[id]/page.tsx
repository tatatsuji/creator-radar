import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VideoDetailView } from "@/components/video/VideoDetailView";
import { getAnalysisPageDescription } from "@/lib/video/analysisDisplay";
import { parseHomeUrlState } from "@/lib/home/urlState";
import { getVideoByIdFromDb } from "@/lib/videos/getVideoFromDb";

interface VideoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; genre?: string; mode?: string }>;
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
  const description = getAnalysisPageDescription(video);

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

  return (
    <VideoDetailView
      video={video}
      period={homeUrlState.period}
      homeUrlState={homeUrlState}
    />
  );
}
