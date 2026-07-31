import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { QuotaReservePool } from "@/lib/quota/quotaManagerConfig";

export type QuotaUsagePool = QuotaReservePool | "general";

export interface QuotaUsageTotals {
  dailySpentUnits: number;
  hourlySpentUnits: number;
  reserveSpentUnits: Record<QuotaReservePool, number>;
  generalSpentUnits: number;
}

function emptyReserveSpent(): Record<QuotaReservePool, number> {
  return {
    measurementCritical: 0,
    watchlist: 0,
    emergencyDiscovery: 0,
  };
}

function mapRunTypeToPool(runType: string | null): QuotaUsagePool {
  if (runType === "watchlist_check") {
    return "watchlist";
  }
  return "general";
}

export async function loadQuotaUsageTotals(input: {
  dayStartedAt: string;
  hourStartedAt: string;
}): Promise<QuotaUsageTotals> {
  if (!isSupabaseConfigured()) {
    return {
      dailySpentUnits: 0,
      hourlySpentUnits: 0,
      reserveSpentUnits: emptyReserveSpent(),
      generalSpentUnits: 0,
    };
  }

  const supabase = createSupabaseServerClient();
  const reserveSpentUnits = emptyReserveSpent();
  let dailySpentUnits = 0;
  let hourlySpentUnits = 0;
  let generalSpentUnits = 0;

  const { data: discoveryRuns, error: discoveryError } = await supabase
    .from("discovery_runs")
    .select("run_type,youtube_quota_estimate,started_at")
    .gte("started_at", input.dayStartedAt);

  if (discoveryError) {
    throw new Error(`discovery_runs quota lookup failed: ${discoveryError.message}`);
  }

  for (const row of discoveryRuns ?? []) {
    const units = Number(row.youtube_quota_estimate) || 0;
    dailySpentUnits += units;
    if (row.started_at >= input.hourStartedAt) {
      hourlySpentUnits += units;
    }

    const pool = mapRunTypeToPool(row.run_type);
    if (pool === "general") {
      generalSpentUnits += units;
    } else {
      reserveSpentUnits[pool] += units;
    }
  }

  const { data: measurementRuns, error: measurementError } = await supabase
    .from("snapshot_runs")
    .select("youtube_quota_used,started_at,run_type")
    .gte("started_at", input.dayStartedAt)
    .eq("run_type", "measurement");

  if (measurementError) {
    throw new Error(`snapshot_runs quota lookup failed: ${measurementError.message}`);
  }

  for (const row of measurementRuns ?? []) {
    const units = Number(row.youtube_quota_used) || 0;
    dailySpentUnits += units;
    if (row.started_at >= input.hourStartedAt) {
      hourlySpentUnits += units;
    }
    generalSpentUnits += units;
  }

  return {
    dailySpentUnits,
    hourlySpentUnits,
    reserveSpentUnits,
    generalSpentUnits,
  };
}
