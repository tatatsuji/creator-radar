#!/usr/bin/env node

import { buildRankings } from "../src/lib/ranking/buildRankings";
import { buildEarlyRiseRankingVideos } from "../src/lib/ranking/engines/earlyRiseRanking";
import { buildPotentialRankingVideos } from "../src/lib/ranking/engines/potentialRanking";
import {
  buildEarlyRiseRankReason,
  calculateEarlyRiseScore,
  countEarlyRiseEligible,
  getEarlyRiseMetricSummary,
  isEarlyRiseEligible,
} from "../src/lib/ranking/earlyRiseScore";
import {
  buildPotentialRankReason,
  calculatePotentialScore,
  countPotentialEligible,
  getPotentialMetricSummary,
  isPotentialEligible,
} from "../src/lib/ranking/potentialScore";
import {
  enrichVideosWithSnapshots,
  getMeasuredRankingCandidates,
  getPublishedAgeHours,
  type SnapshotEnrichedVideo,
} from "../src/lib/ranking/snapshotRankingBase";
import { analyzeMixedSourceSnapshots } from "../src/lib/observability/velocity";
import { computePriorIntervalVelocity } from "../src/lib/promotion/metrics";
import { computeLatestSnapshotGrowth } from "../src/lib/snapshots/snapshotGrowth";
import { isSupabaseConfigured } from "../src/lib/supabase/server";

const RANKINGS = ["buzz", "early_rise", "launch_speed", "potential"] as const;

function hasYouTubeApiKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function summarizeDistribution(values: number[]): Record<string, number | string> {
  if (values.length === 0) {
    return { count: 0, min: "-", max: "-", median: "-", avg: "-" };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const med = median(values);

  return {
    count: values.length,
    min: round(min),
    max: round(max),
    median: med === null ? "-" : round(med),
    avg: round(avg),
  };
}

function countOrderMatches(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  let matches = 0;
  for (let index = 0; index < limit; index += 1) {
    if (left[index] === right[index]) {
      matches += 1;
    }
  }
  return matches;
}

function spearmanRankCorrelation(left: string[], right: string[]): number | null {
  const shared = left.filter((id) => right.includes(id));
  if (shared.length < 2) {
    return null;
  }

  const leftRank = new Map(left.map((id, index) => [id, index + 1]));
  const rightRank = new Map(right.map((id, index) => [id, index + 1]));
  const diffs = shared.map((id) => leftRank.get(id)! - rightRank.get(id)!);
  const sumSquaredDiffs = diffs.reduce((sum, diff) => sum + diff * diff, 0);
  const n = shared.length;

  return 1 - (6 * sumSquaredDiffs) / (n * (n * n - 1));
}

function resolvePreviousVelocity(entry: SnapshotEnrichedVideo): number | null {
  const metrics = entry.promotionMetrics;
  if (!metrics) {
    return null;
  }

  const priorFromWindows = computePriorIntervalVelocity(metrics.v1h, metrics.v3h);
  if (priorFromWindows !== null) {
    return priorFromWindows;
  }

  const latestGrowth = computeLatestSnapshotGrowth(entry.snapshots);
  return latestGrowth?.previousViewsPerHour ?? null;
}

function auditAcceleration(allEnriched: SnapshotEnrichedVideo[]): void {
  console.log("\n## acceleration audit");

  const rates = allEnriched
    .map((entry) => entry.promotionMetrics?.velocityChangeRate)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const percentRates = rates.map((value) => value * 100);
  const nearZero = rates.filter((value) => Math.abs(value) < 0.05).length;
  const positive = rates.filter((value) => value > 0).length;
  const negative = rates.filter((value) => value < 0).length;
  const near200 = rates.filter((value) => value >= 1.8 && value <= 2.2).length;

  console.log("velocityChangeRate distribution (%):", summarizeDistribution(percentRates));
  console.log(`near zero (|rate| < 5%): ${nearZero}`);
  console.log(`positive: ${positive}`);
  console.log(`negative: ${negative}`);
  console.log(`near 200% (1.8-2.2 ratio): ${near200}`);

  const outliers = allEnriched
    .filter((entry) => {
      const rate = entry.promotionMetrics?.velocityChangeRate;
      return rate !== null && (rate >= 5 || rate <= -0.9 || (rate >= 1.8 && rate <= 2.2));
    })
    .map((entry) => ({
      video_id: entry.video.id,
      title: entry.video.title.slice(0, 40),
      velocityChangeRate: round((entry.promotionMetrics?.velocityChangeRate ?? 0) * 100, 1),
      v1h: round(entry.promotionMetrics?.v1h ?? 0, 1),
      v3h: round(entry.promotionMetrics?.v3h ?? 0, 1),
      snapshots: entry.snapshots.length,
    }));

  console.log("\noutlier candidates:");
  console.table(outliers);

  const twoPointVideos = allEnriched
    .filter((entry) => entry.snapshots.length === 2)
    .map((entry) => ({
      video_id: entry.video.id,
      snapshots: entry.snapshots.length,
      v1h: entry.promotionMetrics?.v1h ?? null,
      velocityChangeRate: entry.promotionMetrics?.velocityChangeRate ?? null,
      velocityChangeAbsolute: entry.promotionMetrics?.velocityChangeAbsolute ?? null,
      accelerationPerHour: entry.promotionMetrics?.accelerationPerHour ?? null,
      earlyEligible: isEarlyRiseEligible(entry),
    }));

  console.log("\n2-point snapshot videos:");
  console.table(twoPointVideos);

  const extremeGapVideos = allEnriched
    .map((entry) => {
      const gaps = analyzeMixedSourceSnapshots(entry.snapshots);
      return {
        entry,
        gaps,
      };
    })
    .filter(({ gaps, entry }) =>
      entry.snapshots.length >= 2 &&
      ((gaps.minGapMinutes !== null && gaps.minGapMinutes < 30) ||
        (gaps.maxGapHours !== null && gaps.maxGapHours > 12)),
    )
    .map(({ entry, gaps }) => ({
      video_id: entry.video.id,
      snapshots: entry.snapshots.length,
      minGapMinutes: gaps.minGapMinutes === null ? null : round(gaps.minGapMinutes, 1),
      maxGapHours: gaps.maxGapHours === null ? null : round(gaps.maxGapHours, 1),
      duplicateHourBuckets: gaps.duplicateHourBuckets,
    }));

  console.log("\nextreme snapshot interval videos:");
  console.table(extremeGapVideos);
}

function auditEarlyRiseTop10(
  enriched: SnapshotEnrichedVideo[],
  rankedVideos: ReturnType<typeof buildEarlyRiseRankingVideos>,
): void {
  console.log("\n## early_rise top 10 audit");
  const enrichedById = new Map(enriched.map((entry) => [entry.video.id, entry]));

  const rows = rankedVideos.slice(0, 10).map((video, index) => {
    const entry = enrichedById.get(video.id)!;
    const metrics = entry.promotionMetrics!;
    const breakdown = calculateEarlyRiseScore(entry);
    const summary = getEarlyRiseMetricSummary(entry);
    const previousVelocity = resolvePreviousVelocity(entry);

    return {
      rank: index + 1,
      video_id: video.id,
      title: video.title.slice(0, 45),
      snapshots: entry.snapshots.length,
      currentVelocity: round(metrics.v1h ?? 0, 1),
      previousVelocity: previousVelocity === null ? null : round(previousVelocity, 1),
      velocityChangeAbsolute: metrics.velocityChangeAbsolute === null
        ? summary.velocityChangeAbsolute
        : round(metrics.velocityChangeAbsolute, 1),
      velocityChangeRatePct: metrics.velocityChangeRate === null
        ? null
        : round((metrics.velocityChangeRate ?? 0) * 100, 1),
      accelerationPerHour: metrics.accelerationPerHour === null
        ? null
        : round(metrics.accelerationPerHour, 1),
      selfBaseline: summary.selfBaselineRatio === null
        ? null
        : round(summary.selfBaselineRatio as number, 2),
      score: breakdown.score,
      rankReason: video.rankingDisplay?.rankReason ?? buildEarlyRiseRankReason(entry),
      ageHours: round(getPublishedAgeHours(video.publishedAt), 1),
      accelPositive: (metrics.velocityChangeRate ?? 0) > 0,
      velocityUp: (metrics.velocityChangeAbsolute ?? 0) > 0,
    };
  });

  console.table(rows);
}

function auditPotentialTop10(
  enriched: SnapshotEnrichedVideo[],
  rankedVideos: ReturnType<typeof buildPotentialRankingVideos>,
): void {
  console.log("\n## potential top 10 audit");
  const pool = enriched.filter(isPotentialEligible);
  const enrichedById = new Map(enriched.map((entry) => [entry.video.id, entry]));

  const rows = rankedVideos.slice(0, 10).map((video, index) => {
    const entry = enrichedById.get(video.id)!;
    const metrics = entry.promotionMetrics!;
    const breakdown = calculatePotentialScore(entry, pool);

    return {
      rank: index + 1,
      video_id: video.id,
      title: video.title.slice(0, 45),
      snapshots: entry.snapshots.length,
      sustainedGrowth: breakdown.sustainedGrowth === null ? null : round(breakdown.sustainedGrowth, 1),
      noSlowdown: breakdown.noSlowdown === null ? null : round(breakdown.noSlowdown, 1),
      v3h: metrics.v3h === null ? null : round(metrics.v3h, 1),
      v24h: metrics.v24h === null ? null : round(metrics.v24h, 1),
      subscriberRatio: breakdown.subscriberRatio === null ? null : round(breakdown.subscriberRatio, 1),
      engagementGrowth: breakdown.engagementGrowth === null ? null : round(breakdown.engagementGrowth, 1),
      confidence: breakdown.confidence === null ? null : round(breakdown.confidence, 1),
      score: breakdown.score,
      rankReason: video.rankingDisplay?.rankReason ?? buildPotentialRankReason(entry, pool),
      snapshotsOk: entry.snapshots.length >= 3,
    };
  });

  console.table(rows);
}

function compareRankings(
  earlyVideos: ReturnType<typeof buildEarlyRiseRankingVideos>,
  potentialVideos: ReturnType<typeof buildPotentialRankingVideos>,
): void {
  const earlyTop = earlyVideos.slice(0, 10);
  const potentialTop = potentialVideos.slice(0, 10);
  const earlyIds = earlyTop.map((video) => video.id);
  const potentialIds = potentialTop.map((video) => video.id);
  const overlap = earlyIds.filter((id) => potentialIds.includes(id));
  const orderMatches = countOrderMatches(earlyIds, potentialIds);
  const spearman = spearmanRankCorrelation(earlyIds, potentialIds);

  const earlyOnly = earlyIds.filter((id) => !potentialIds.includes(id));
  const potentialOnly = potentialIds.filter((id) => !earlyIds.includes(id));

  const rankDiffs = overlap.map((id) => ({
    video_id: id,
    early_rank: earlyIds.indexOf(id) + 1,
    potential_rank: potentialIds.indexOf(id) + 1,
    delta: Math.abs(earlyIds.indexOf(id) - potentialIds.indexOf(id)),
  })).sort((left, right) => right.delta - left.delta);

  console.log("\n## early_rise vs potential comparison");
  console.log(`overlap: ${overlap.length}/${earlyIds.length} (${earlyIds.length ? round((overlap.length / earlyIds.length) * 100, 1) : 0}%)`);
  console.log(`same position: ${orderMatches}/${Math.min(earlyIds.length, potentialIds.length)}`);
  console.log(
    `order match rate: ${Math.min(earlyIds.length, potentialIds.length) ? round((orderMatches / Math.min(earlyIds.length, potentialIds.length)) * 100, 1) : 0}%`,
  );
  console.log(`spearman rho: ${spearman === null ? "n/a" : round(spearman, 3)}`);
  console.log(`early_rise only: ${earlyOnly.join(", ") || "(none)"}`);
  console.log(`potential only: ${potentialOnly.join(", ") || "(none)"}`);
  console.log("\nlargest rank differences among overlap:");
  console.table(rankDiffs.slice(0, 5));
}

async function main(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase is not configured. Measured ranking audit will be empty.");
  }

  const tables = new Map<string, Array<Record<string, unknown>>>();
  const candidates = isSupabaseConfigured()
    ? await getMeasuredRankingCandidates("24h", "all")
    : [];
  const allEnriched = await enrichVideosWithSnapshots(candidates);

  auditAcceleration(allEnriched);

  const earlyBuilt = await buildRankings("early_rise", "24h", "all");
  const potentialBuilt = await buildRankings("potential", "24h", "all");
  const earlyRanked = buildEarlyRiseRankingVideos(allEnriched);
  const potentialRanked = buildPotentialRankingVideos(allEnriched);

  auditEarlyRiseTop10(allEnriched, earlyRanked);
  auditPotentialTop10(allEnriched, potentialRanked);
  compareRankings(earlyRanked, potentialRanked);

  for (const ranking of RANKINGS) {
    if (ranking === "buzz" && !hasYouTubeApiKey()) {
      console.log("\n## buzz skipped (YOUTUBE_API_KEY not configured)");
      tables.set(ranking, []);
      continue;
    }

    const built = ranking === "early_rise"
      ? earlyBuilt
      : ranking === "potential"
        ? potentialBuilt
        : await buildRankings(ranking, "24h", "all");
    const enriched = await enrichVideosWithSnapshots(built.videos);
    const enrichedById = new Map(enriched.map((entry) => [entry.video.id, entry]));
    const pool = allEnriched.filter(isPotentialEligible);

    const rows = built.videos.slice(0, 10).map((video, index) => {
      const entry = enrichedById.get(video.id);
      const metrics = entry?.promotionMetrics;
      const earlySummary = entry ? getEarlyRiseMetricSummary(entry) : null;
      const potentialSummary = entry ? getPotentialMetricSummary(entry, pool) : null;

      return {
        rank: index + 1,
        video_id: video.id,
        title: video.title.slice(0, 50),
        scoreName: video.rankingDisplay?.scoreName,
        score: video.rankingDisplay?.scoreValue ?? video.metrics.rankingScore,
        rankReason: video.rankingDisplay?.rankReason,
        metricsSource: video.metrics.metricsSource,
        ageHours: round(getPublishedAgeHours(video.publishedAt), 1),
        viewsPerHour: metrics?.v1h ?? null,
        velocityChangeRate: metrics?.velocityChangeRate ?? null,
        velocityChangeAbsolute: metrics?.velocityChangeAbsolute ?? null,
        accelerationPerHour: metrics?.accelerationPerHour ?? null,
        earlyScore: earlySummary?.score ?? null,
        potentialScore: potentialSummary?.score ?? null,
        readiness: built.readiness.status,
        eligibleCount: built.readiness.eligibleCount,
        totalVideos: built.videos.length,
      };
    });

    tables.set(ranking, rows);
    console.log(`\n## ${ranking} (status=${built.readiness.status}, total=${built.videos.length}, eligible=${built.readiness.eligibleCount})`);
    console.table(rows);
  }

  const measuredEntries = allEnriched.filter((entry) => entry.promotionMetrics?.v1h !== null);
  const accelerationRates = measuredEntries
    .map((entry) => entry.promotionMetrics?.velocityChangeRate)
    .filter((value): value is number => value !== null);
  const earlyScores = measuredEntries
    .filter(isEarlyRiseEligible)
    .map((entry) => getEarlyRiseMetricSummary(entry).score)
    .filter((value): value is number => value !== null);
  const potentialScores = measuredEntries
    .filter(isPotentialEligible)
    .map((entry) => getPotentialMetricSummary(entry, allEnriched.filter(isPotentialEligible)).score)
    .filter((value): value is number => value !== null);

  console.log("\n## score distributions");
  console.log("velocityChangeRate:", summarizeDistribution(accelerationRates.map((value) => value * 100)));
  console.log("earlyRiseScore:", summarizeDistribution(earlyScores));
  console.log("potentialScore:", summarizeDistribution(potentialScores));

  console.log("\n## exclusions");
  console.log(`total measured candidates: ${candidates.length}`);
  console.log(`early_rise eligible: ${countEarlyRiseEligible(allEnriched)}`);
  console.log(`potential eligible: ${countPotentialEligible(allEnriched)}`);
  console.log(
    `early_rise excluded: ${candidates.length - countEarlyRiseEligible(allEnriched)}`,
  );
  console.log(
    `potential excluded: ${candidates.length - countPotentialEligible(allEnriched)}`,
  );

  const buzzIds = tables.get("buzz")!.map((row) => row.video_id as string);
  console.log("\n## overlap rates vs buzz top 10");
  for (const ranking of RANKINGS) {
    if (ranking === "buzz") continue;
    const ids = tables.get(ranking)!.map((row) => row.video_id as string);
    const buzzOverlap = ids.filter((id) => buzzIds.includes(id)).length;
    console.log(`${ranking}: ${buzzOverlap}/${Math.max(ids.length, 1)} (${ids.length ? round((buzzOverlap / ids.length) * 100, 1) : 0}%)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
