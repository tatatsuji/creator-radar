import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  DEFAULT_CATEGORY_STRATEGY,
  discoveryRunIndex,
  pickGenresForCategoryFetch,
  pickMostPopularFetches,
} from "@/lib/discovery/categoryStrategy";
import { runCandidateDiscoveryCron } from "@/lib/discovery/runCandidateDiscoveryCron";
import { runWatchlistDiscoveryCron } from "@/lib/discovery/runWatchlistDiscoveryCron";
import { estimateDiscoveryQuotaPerRun } from "@/lib/discovery/quotaBudget";
import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";

vi.mock("@/lib/discovery/runWatchlistDiscovery", () => ({
  runWatchlistDiscovery: vi.fn(),
}));

vi.mock("@/lib/discovery/candidateDiscoveryEngine", () => ({
  runCandidateDiscoveryEngine: vi.fn(),
}));

vi.mock("@/lib/quota/quotaGatedCron", () => ({
  runQuotaGatedOperation: vi.fn(async ({ execute }) => ({
    status: "executed",
    operationType: "mock",
    authorization: { reason: "test" },
    result: await execute(),
  })),
}));

import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import { runCandidateDiscoveryEngine } from "@/lib/discovery/candidateDiscoveryEngine";

const watchlistSuccess = {
  runId: "wl-1",
  status: "success" as const,
  channelsDue: 1,
  channelsProcessed: 1,
  channelsFailed: 0,
  channelsSkippedWebsubHealthy: 0,
  channelsSafetyPoll: 0,
  channelsNormalPoll: 1,
  videosDiscovered: 1,
  discoveriesInserted: 1,
  discoveriesDuplicate: 0,
  youtubeQuotaEstimate: 2,
  errors: [],
};

const candidateSuccess = {
  runId: "cd-1",
  status: "success" as const,
  totalFetched: 10,
  totalRegistered: 5,
  sources: [],
  dbRemeasure: {
    candidatesProcessed: 0,
    schedulesCreated: 0,
    schedulesExisting: 0,
    discoveriesInserted: 0,
    discoveriesDuplicate: 0,
    failures: 0,
  },
  youtubeQuotaEstimate: 100,
  errors: [],
};

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github/workflows/observability-cron.yml",
);

describe("discovery cron entrypoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runWatchlistDiscoveryCron calls runWatchlistDiscovery only", async () => {
    vi.mocked(runWatchlistDiscovery).mockResolvedValue(watchlistSuccess);

    const result = await runWatchlistDiscoveryCron();

    expect(runWatchlistDiscovery).toHaveBeenCalledTimes(1);
    expect(runCandidateDiscoveryEngine).not.toHaveBeenCalled();
    expect(result.watchlist).toEqual(watchlistSuccess);
  });

  it("runCandidateDiscoveryCron calls runCandidateDiscoveryEngine only", async () => {
    vi.mocked(runCandidateDiscoveryEngine).mockResolvedValue(candidateSuccess);

    const result = await runCandidateDiscoveryCron();

    expect(runCandidateDiscoveryEngine).toHaveBeenCalledTimes(1);
    expect(runWatchlistDiscovery).not.toHaveBeenCalled();
    expect(result.candidateDiscovery).toEqual(candidateSuccess);
  });
});

describe("observability cron config separation", () => {
  it("uses independent intervals for watchlist and candidate discovery", () => {
    expect(OBSERVABILITY_CONFIG.watchlistDiscovery.cronIntervalMs).toBe(
      60 * 60 * 1000,
    );
    expect(OBSERVABILITY_CONFIG.phase1Discovery.discoveryRunIntervalMs).toBe(
      6 * 60 * 60 * 1000,
    );
    expect(OBSERVABILITY_CONFIG.watchlistDiscovery.cronIntervalMs).not.toBe(
      OBSERVABILITY_CONFIG.phase1Discovery.discoveryRunIntervalMs,
    );
  });

  it("keeps candidate quota runsPerDay at 4", () => {
    expect(OBSERVABILITY_CONFIG.phase1Discovery.categoryStrategy.runsPerDay).toBe(
      4,
    );

    const quota = estimateDiscoveryQuotaPerRun(0);
    const categoryDaily = quota.sources.find(
      (source) => source.source === "category_search",
    );
    expect(categoryDaily?.unitsPerDay).toBe(categoryDaily!.unitsPerRun * 4);
  });

  it("defines separate GitHub Actions schedules", () => {
    expect(OBSERVABILITY_CONFIG.cronSchedules.githubActionsWatchlistDiscovery).toBe(
      "0 * * * *",
    );
    expect(OBSERVABILITY_CONFIG.cronSchedules.githubActionsCandidateDiscovery).toBe(
      "0 */6 * * *",
    );
    expect(OBSERVABILITY_CONFIG.cronSchedules.githubActionsMeasurement).toBe(
      "15 * * * *",
    );
  });
});

describe("category rotation with 6-hour candidate interval", () => {
  const sixHoursMs = 6 * 60 * 60 * 1000;

  it("computes discoveryRunIndex in 6-hour buckets", () => {
    const base = Date.parse("2026-07-24T00:00:00.000Z");
    expect(discoveryRunIndex(base)).toBe(discoveryRunIndex(base + 5 * 60 * 60 * 1000));
    expect(discoveryRunIndex(base + sixHoursMs)).toBe(discoveryRunIndex(base) + 1);
  });

  it("includes the daily genre on one run out of four consecutive indices", () => {
    const dailyRuns = [0, 1, 2, 3].filter((runIndex) =>
      pickGenresForCategoryFetch(runIndex, DEFAULT_CATEGORY_STRATEGY).includes(
        "news",
      ),
    );
    expect(dailyRuns).toEqual([0]);
  });

  it("rotates howto and sports across consecutive 6-hour run indices", () => {
    const run0 = pickGenresForCategoryFetch(0, DEFAULT_CATEGORY_STRATEGY);
    const run1 = pickGenresForCategoryFetch(1, DEFAULT_CATEGORY_STRATEGY);

    expect(run0.includes("howto") || run0.includes("sports")).toBe(true);
    expect(run1.includes("howto") || run1.includes("sports")).toBe(true);
    expect(run0.includes("howto")).not.toBe(run1.includes("howto"));
  });

  it("aligns mostPopular rotation with the same 6-hour run index", () => {
    const run0Plans = pickMostPopularFetches(0, DEFAULT_CATEGORY_STRATEGY).map(
      (plan) => plan.genre,
    );
    const run1Plans = pickMostPopularFetches(1, DEFAULT_CATEGORY_STRATEGY).map(
      (plan) => plan.genre,
    );

    expect(run0Plans).toContain("news");
    expect(run1Plans).not.toContain("news");
  });
});

describe("GitHub Actions workflow schedules", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");

  function extractJobBlock(jobName: string): string {
    const match = workflow.match(
      new RegExp(`  ${jobName}:[\\s\\S]*?(?=\\n  [a-z-]+:|$)`),
    );
    return match?.[0] ?? "";
  }

  it("runs watchlist discovery hourly without invoking candidate discovery", () => {
    const watchlistJob = extractJobBlock("watchlist-discovery");

    expect(workflow).toContain('- cron: "0 * * * *"');
    expect(watchlistJob).toContain("github.event.schedule == '0 * * * *'");
    expect(watchlistJob).toContain("npm run cron:watchlist-discovery");
    expect(watchlistJob).not.toContain("npm run cron:candidate-discovery");
    expect(watchlistJob).not.toContain("npm run cron:discovery");
  });

  it("runs candidate discovery every 6 hours on its own schedule guard", () => {
    const candidateJob = extractJobBlock("candidate-discovery");

    expect(workflow).toContain('- cron: "0 */6 * * *"');
    expect(candidateJob).toContain("github.event.schedule == '0 */6 * * *'");
    expect(candidateJob).toContain("npm run cron:candidate-discovery");
    expect(candidateJob).not.toContain("npm run cron:watchlist-discovery");
    expect(candidateJob).not.toContain("npm run cron:discovery");
  });

  it("keeps measurement on the existing hourly :15 schedule", () => {
    const measurementJob = extractJobBlock("measurement");

    expect(workflow).toContain('- cron: "15 * * * *"');
    expect(measurementJob).toContain("github.event.schedule == '15 * * * *'");
    expect(measurementJob).toContain("npm run cron:measurement");
  });

  it("runs auto watchlist on its own daily schedule", () => {
    const autoWatchlistJob = extractJobBlock("auto-watchlist");

    expect(workflow).toContain('- cron: "30 3 * * *"');
    expect(autoWatchlistJob).toContain("github.event.schedule == '30 3 * * *'");
    expect(autoWatchlistJob).toContain("npm run cron:auto-watchlist");
    expect(autoWatchlistJob).not.toContain("npm run cron:watchlist-discovery");
    expect(autoWatchlistJob).not.toContain("npm run cron:candidate-discovery");
  });

  it("limits combined discovery cron to manual workflow_dispatch only", () => {
    const discoveryBothJob = extractJobBlock("discovery-both");

    expect(discoveryBothJob).toContain("github.event_name == 'workflow_dispatch'");
    expect(discoveryBothJob).toContain("discovery-both");
    expect(discoveryBothJob).toContain("npm run cron:discovery");
    expect(extractJobBlock("watchlist-discovery")).not.toContain(
      "npm run cron:discovery",
    );
    expect(extractJobBlock("candidate-discovery")).not.toContain(
      "npm run cron:discovery",
    );
  });
});
