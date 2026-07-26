"use client";

import { useRouter } from "next/navigation";

import { PeriodTabs } from "@/components/ui/PeriodTabs";
import { buildVideoDetailHref, type HomeUrlState } from "@/lib/home/urlState";
import type { RankingPeriod } from "@/types";

interface VideoDetailPeriodTabsProps {
  videoId: string;
  period: RankingPeriod;
  homeUrlState: HomeUrlState;
}

export function VideoDetailPeriodTabs({
  videoId,
  period,
  homeUrlState,
}: VideoDetailPeriodTabsProps) {
  const router = useRouter();

  return (
    <PeriodTabs
      value={period}
      onChange={(nextPeriod) => {
        router.push(
          buildVideoDetailHref(videoId, {
            ...homeUrlState,
            period: nextPeriod,
          }),
        );
      }}
    />
  );
}
