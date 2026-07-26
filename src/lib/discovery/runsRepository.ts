import { OBSERVABILITY_CONFIG } from "@/lib/observability/config";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { DiscoveryRunRow } from "@/types/database";
import type { DiscoveryRunStatus, DiscoveryRunType } from "@/types/observability";
import { isDiscoveryRunStatus, isDiscoveryRunType } from "@/types/observability";

export interface FinishDiscoveryRunInput {
  status: DiscoveryRunStatus;
  itemsProcessed: number;
  itemsDiscovered: number;
  itemsFailed: number;
  youtubeQuotaEstimate: number;
  cursor?: string | null;
  errorSummary?: string | null;
  metadata?: Record<string, unknown> | null;
}

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

export async function startDiscoveryRun(
  runType: DiscoveryRunType = OBSERVABILITY_CONFIG.defaults.discoveryRunType,
): Promise<string> {
  assertSupabaseConfigured();

  if (!isDiscoveryRunType(runType)) {
    throw new Error(`Invalid discovery run type: ${runType}`);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discovery_runs")
    .insert({
      run_type: runType,
      status: OBSERVABILITY_CONFIG.defaults.discoveryRunStatus,
      algorithm_version: OBSERVABILITY_CONFIG.discoveryAlgorithmVersion,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`discovery_runs insert failed: ${error.message}`);
  }

  return data.id as string;
}

export async function finishDiscoveryRun(
  runId: string,
  input: FinishDiscoveryRunInput,
): Promise<void> {
  assertSupabaseConfigured();

  if (!isDiscoveryRunStatus(input.status)) {
    throw new Error(`Invalid discovery run status: ${input.status}`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("discovery_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: input.status,
      items_processed: input.itemsProcessed,
      items_discovered: input.itemsDiscovered,
      items_failed: input.itemsFailed,
      youtube_quota_estimate: input.youtubeQuotaEstimate,
      cursor: input.cursor ?? null,
      error_summary: input.errorSummary ?? null,
      metadata: input.metadata ?? null,
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`discovery_runs update failed: ${error.message}`);
  }
}

export async function getLatestDiscoveryRun(): Promise<DiscoveryRunRow | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("discovery_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`discovery_runs latest lookup failed: ${error.message}`);
  }

  return (data as DiscoveryRunRow | null) ?? null;
}

export async function findRecentRunningDiscoveryRun(): Promise<DiscoveryRunRow | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const since = new Date(
    Date.now() - OBSERVABILITY_CONFIG.health.discoveryRunningWindowMs,
  ).toISOString();

  const { data, error } = await supabase
    .from("discovery_runs")
    .select("*")
    .eq("status", "running")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`discovery_runs running lookup failed: ${error.message}`);
  }

  return (data as DiscoveryRunRow | null) ?? null;
}
