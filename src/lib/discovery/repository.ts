import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { CandidateDiscoveryRow } from "@/types/database";
import type { DiscoverySourceType } from "@/types/observability";
import { isDiscoverySourceType } from "@/types/observability";

export interface RecordDiscoveryInput {
  videoId: string;
  channelId?: string | null;
  sourceType: DiscoverySourceType;
  sourceKey: string;
  discoveredAt?: string;
  metadata?: Record<string, unknown> | null;
}

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

function validateDiscoveryInput(input: RecordDiscoveryInput): void {
  if (!input.videoId.trim()) {
    throw new Error("videoId must not be empty");
  }
  if (!isDiscoverySourceType(input.sourceType)) {
    throw new Error(`Invalid discovery source type: ${input.sourceType}`);
  }
  if (!input.sourceKey.trim()) {
    throw new Error("sourceKey must not be empty");
  }
}

function isDuplicateKeyError(error: { code?: string }): boolean {
  return error.code === "23505";
}

export async function recordDiscovery(
  input: RecordDiscoveryInput,
): Promise<"inserted" | "duplicate"> {
  validateDiscoveryInput(input);
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("candidate_discoveries").insert({
    video_id: input.videoId,
    channel_id: input.channelId ?? null,
    source_type: input.sourceType,
    source_key: input.sourceKey,
    discovered_at: input.discoveredAt ?? new Date().toISOString(),
    metadata: input.metadata ?? null,
  });

  if (error) {
    if (isDuplicateKeyError(error)) {
      return "duplicate";
    }
    throw new Error(`candidate_discoveries insert failed: ${error.message}`);
  }

  return "inserted";
}

export async function recordDiscoveriesBatch(
  inputs: RecordDiscoveryInput[],
): Promise<{ inserted: number; duplicates: number; failed: number }> {
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;

  for (const input of inputs) {
    try {
      const result = await recordDiscovery(input);
      if (result === "inserted") {
        inserted += 1;
      } else {
        duplicates += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { inserted, duplicates, failed };
}

export async function findVideoDiscoverySources(
  videoId: string,
): Promise<CandidateDiscoveryRow[]> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("candidate_discoveries")
    .select("*")
    .eq("video_id", videoId)
    .order("discovered_at", { ascending: false });

  if (error) {
    throw new Error(`candidate_discoveries lookup failed: ${error.message}`);
  }

  return (data ?? []) as CandidateDiscoveryRow[];
}

export async function countDiscoveriesBySourceType(): Promise<
  Record<string, number>
> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("candidate_discoveries")
    .select("source_type");

  if (error) {
    throw new Error(`candidate_discoveries count failed: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const sourceType = row.source_type as string;
    counts[sourceType] = (counts[sourceType] ?? 0) + 1;
  }

  return counts;
}

export async function countCandidateDiscoveries(): Promise<number> {
  assertSupabaseConfigured();

  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("candidate_discoveries")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`candidate_discoveries total count failed: ${error.message}`);
  }

  return count ?? 0;
}
