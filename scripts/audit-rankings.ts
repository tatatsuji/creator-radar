#!/usr/bin/env node

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const RANKINGS = ["buzz", "early_rise", "launch_speed", "potential"] as const;

interface AuditVideo {
  id: string;
  title: string;
  publishedAt: string;
  metricsSource?: string;
  rankingScore: number;
  rankingDisplay?: {
    scoreName: string;
    scoreValue: number | null;
    rankReason: string | null;
    heroLabel: string;
    heroValue: string;
  };
}

interface AuditResponse {
  ranking: string;
  period: string;
  genre: string;
  readiness?: {
    status: string;
    eligibleCount: number;
    requiredCount: number;
  };
  videos: AuditVideo[];
}

function ageHours(publishedAt: string): number {
  return (Date.now() - Date.parse(publishedAt)) / (60 * 60 * 1000);
}

async function fetchRanking(
  ranking: string,
  period = "24h",
  genre = "all",
): Promise<AuditResponse> {
  const url = `${BASE_URL}/api/rankings?ranking=${ranking}&period=${period}&genre=${genre}`;
  const response = await fetch(url);
  const body = (await response.json()) as AuditResponse & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Failed ${ranking}: ${response.status}`);
  }
  return body;
}

function overlapRate(idsA: string[], idsB: string[]): number {
  const setB = new Set(idsB);
  const overlap = idsA.filter((id) => setB.has(id)).length;
  return idsA.length === 0 ? 0 : overlap / idsA.length;
}

async function main(): Promise<void> {
  const results = new Map<string, AuditResponse>();

  for (const ranking of RANKINGS) {
    results.set(ranking, await fetchRanking(ranking));
  }

  const buzz30d = await fetchRanking("buzz", "30d");

  console.log(JSON.stringify({ audit: "rankings", baseUrl: BASE_URL }, null, 2));

  for (const ranking of RANKINGS) {
    const data = results.get(ranking)!;
    const top10 = data.videos.slice(0, 10);

    console.log(`\n=== ${ranking} (${data.videos.length} videos, readiness=${data.readiness?.status ?? "n/a"}) ===`);

    for (const [index, video] of top10.entries()) {
      console.log(
        JSON.stringify({
          rank: index + 1,
          video_id: video.id,
          title: video.title.slice(0, 60),
          scoreName: video.rankingDisplay?.scoreName ?? "ランキング参考値",
          score: video.rankingDisplay?.scoreValue ?? video.rankingScore,
          rankReason: video.rankingDisplay?.rankReason,
          metricsSource: video.metricsSource ?? video.metrics?.metricsSource,
          ageHours: Math.round(ageHours(video.publishedAt) * 10) / 10,
          hero: video.rankingDisplay?.heroValue,
        }),
      );
    }
  }

  console.log("\n=== Overlap rates (top 10) ===");
  const pairs: Array<[string, string]> = [
    ["buzz", "early_rise"],
    ["buzz", "launch_speed"],
    ["buzz", "potential"],
    ["early_rise", "launch_speed"],
    ["early_rise", "potential"],
    ["launch_speed", "potential"],
  ];

  for (const [a, b] of pairs) {
    const idsA = results.get(a)!.videos.slice(0, 10).map((v) => v.id);
    const idsB = results.get(b)!.videos.slice(0, 10).map((v) => v.id);
    console.log(`${a} vs ${b}: ${(overlapRate(idsA, idsB) * 100).toFixed(0)}%`);
  }

  console.log("\n=== buzz 30d ===");
  console.log(
    JSON.stringify({
      count: buzz30d.videos.length,
      measured: buzz30d.videos.filter((v) => v.metricsSource === "measured").length,
      estimated: buzz30d.videos.filter((v) => v.metricsSource === "estimated").length,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
