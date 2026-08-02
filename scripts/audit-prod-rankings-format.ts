#!/usr/bin/env node

const BASE = process.env.AUDIT_BASE_URL ?? "https://creator-radar-xi.vercel.app";

interface AuditVideo {
  id: string;
  title: string;
  contentKind?: string;
  durationSeconds?: number;
}

async function fetchRanking(format = "all", genre = "all"): Promise<AuditVideo[]> {
  const url = `${BASE}/api/rankings?ranking=buzz&period=24h&genre=${genre}&format=${format}`;
  const response = await fetch(url);
  const body = (await response.json()) as { videos?: AuditVideo[]; total?: number };
  return body.videos ?? [];
}

function analyze(videos: AuditVideo[]) {
  const shortsSuspects = videos.filter(
    (v) =>
      v.contentKind !== "short" &&
      v.contentKind !== "live" &&
      v.durationSeconds != null &&
      v.durationSeconds <= 180,
  );
  const liveInRegular = videos.filter((v) => v.contentKind === "live");
  const hashtagShorts = videos.filter(
    (v) => /#shorts/i.test(v.title) && v.contentKind !== "short",
  );

  return {
    count: videos.length,
    shortsSuspects: shortsSuspects.length,
    liveInRegular: liveInRegular.length,
    hashtagShortsMisclassified: hashtagShorts.length,
    examples: shortsSuspects.slice(0, 5).map((v) => ({
      id: v.id,
      duration: v.durationSeconds,
      title: v.title.slice(0, 50),
    })),
  };
}

async function main(): Promise<void> {
  const [regular, shorts, live] = await Promise.all([
    fetchRanking("all", "all"),
    fetchRanking("short", "shorts"),
    fetchRanking("live", "all"),
  ]);

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE,
        regularRanking: analyze(regular),
        shortsRanking: { count: shorts.length },
        liveRanking: { count: live.length },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
