import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  computeDeferredTerminalCleanupCutoff,
  isDeferredQuotaOperationExpired,
  resolveDeferredRetryUpsert,
} from "@/lib/quota/quotaManagerLogic";
import {
  QUOTA_MANAGER_CONFIG,
  type QuotaOperationType,
} from "@/lib/quota/quotaManagerConfig";

export type QuotaDeferredStatus = "pending" | "processing" | "completed" | "cancelled";

export interface QuotaDeferredOperationRow {
  id: string;
  operation_type: QuotaOperationType;
  payload: Record<string, unknown>;
  estimated_units: number;
  priority: number;
  reason: string;
  deferred_at: string;
  retry_after: string;
  attempt_count: number;
  max_attempts: number;
  status: QuotaDeferredStatus;
  updated_at: string;
}

interface EnqueueDeferredQuotaOperationResult {
  id: string;
  status: QuotaDeferredStatus;
  attempt_count: number;
}

export async function enqueueDeferredQuotaOperation(input: {
  operationType: QuotaOperationType;
  estimatedUnits: number;
  priority: number;
  reason: string;
  payload?: Record<string, unknown>;
  retryAfter?: Date;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const retryAfter =
    input.retryAfter ??
    new Date(Date.now() + QUOTA_MANAGER_CONFIG.deferRetryMs);

  const { data, error } = await supabase.rpc("enqueue_quota_deferred_operation", {
    p_operation_type: input.operationType,
    p_payload: input.payload ?? {},
    p_estimated_units: input.estimatedUnits,
    p_priority: input.priority,
    p_reason: input.reason,
    p_retry_after: retryAfter.toISOString(),
    p_max_attempts: QUOTA_MANAGER_CONFIG.maxDeferAttempts,
  });

  if (error) {
    throw new Error(`quota_deferred_operations enqueue failed: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | EnqueueDeferredQuotaOperationResult
    | null
    | undefined;

  if (!row || row.status === "cancelled") {
    return null;
  }

  return row.id;
}

export async function listDueDeferredQuotaOperations(
  operationType?: QuotaOperationType,
  limit = 20,
): Promise<QuotaDeferredOperationRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("quota_deferred_operations")
    .select("*")
    .eq("status", "pending")
    .lte("retry_after", now)
    .order("priority", { ascending: false })
    .order("deferred_at", { ascending: true })
    .limit(limit);

  if (operationType) {
    query = query.eq("operation_type", operationType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`quota_deferred_operations lookup failed: ${error.message}`);
  }

  return (data ?? []) as QuotaDeferredOperationRow[];
}

export async function markDeferredQuotaOperationCompleted(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("quota_deferred_operations")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`quota_deferred_operations complete failed: ${error.message}`);
  }
}

export async function rescheduleDeferredQuotaOperation(input: {
  id: string;
  reason: string;
  retryAfter?: Date;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { data, error: readError } = await supabase
    .from("quota_deferred_operations")
    .select("attempt_count,max_attempts")
    .eq("id", input.id)
    .maybeSingle();

  if (readError) {
    throw new Error(`quota_deferred_operations read failed: ${readError.message}`);
  }

  const decision = resolveDeferredRetryUpsert({
    attempt_count: data?.attempt_count ?? 0,
    max_attempts: data?.max_attempts ?? QUOTA_MANAGER_CONFIG.maxDeferAttempts,
  });
  const retryAfter =
    input.retryAfter ??
    new Date(Date.now() + QUOTA_MANAGER_CONFIG.deferRetryMs);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("quota_deferred_operations")
    .update({
      status: decision.action === "cancel" ? "cancelled" : "pending",
      attempt_count: decision.nextAttemptCount,
      reason: input.reason,
      retry_after: retryAfter.toISOString(),
      updated_at: now,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`quota_deferred_operations reschedule failed: ${error.message}`);
  }
}

export {
  computeDeferredTerminalCleanupCutoff,
  isDeferredQuotaOperationExpired,
};
