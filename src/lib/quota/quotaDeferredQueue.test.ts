import { beforeEach, describe, expect, it, vi } from "vitest";

import { enqueueDeferredQuotaOperation } from "@/lib/quota/quotaDeferredQueue";
import { QUOTA_MANAGER_CONFIG } from "@/lib/quota/quotaManagerConfig";

interface MockDeferredRow {
  id: string;
  operation_type: string;
  attempt_count: number;
  max_attempts: number;
  status: "pending" | "cancelled";
}

function createAtomicEnqueueRpcMock(defaultMaxAttempts = 48) {
  const pendingByOperation = new Map<string, MockDeferredRow>();
  let nextId = 1;

  const rpc = vi.fn(
    (
      functionName: string,
      params: {
        p_operation_type: string;
        p_max_attempts?: number;
        [key: string]: unknown;
      },
    ) => {
      if (functionName !== "enqueue_quota_deferred_operation") {
        return Promise.resolve({
          data: null,
          error: { message: `unexpected rpc: ${functionName}` },
        });
      }

      const operationType = params.p_operation_type;
      const maxAttempts = params.p_max_attempts ?? defaultMaxAttempts;
      const existing = pendingByOperation.get(operationType);

      if (!existing) {
        const row: MockDeferredRow = {
          id: `defer-${nextId++}`,
          operation_type: operationType,
          attempt_count: 1,
          max_attempts: maxAttempts,
          status: "pending",
        };
        pendingByOperation.set(operationType, row);
        return Promise.resolve({
          data: [
            {
              id: row.id,
              status: row.status,
              attempt_count: row.attempt_count,
            },
          ],
          error: null,
        });
      }

      const nextAttemptCount = existing.attempt_count + 1;
      existing.attempt_count = nextAttemptCount;
      existing.status =
        nextAttemptCount >= existing.max_attempts ? "cancelled" : "pending";

      if (existing.status === "cancelled") {
        pendingByOperation.delete(operationType);
      }

      return Promise.resolve({
        data: [
          {
            id: existing.id,
            status: existing.status,
            attempt_count: nextAttemptCount,
          },
        ],
        error: null,
      });
    },
  );

  return {
    rpc,
    pendingByOperation,
    pendingCount() {
      return pendingByOperation.size;
    },
  };
}

async function withMaxDeferAttempts(
  maxAttempts: number,
  run: () => Promise<void>,
): Promise<void> {
  const config = QUOTA_MANAGER_CONFIG as { maxDeferAttempts: number };
  const previous = config.maxDeferAttempts;
  config.maxDeferAttempts = maxAttempts;

  try {
    await run();
  } finally {
    config.maxDeferAttempts = previous;
  }
}

const mockFrom = vi.fn();
let atomicMock = createAtomicEnqueueRpcMock();

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: () => ({
    rpc: (functionName: string, params: Record<string, unknown>) =>
      atomicMock.rpc(
        functionName,
        params as {
          p_operation_type: string;
          p_max_attempts?: number;
          [key: string]: unknown;
        },
      ),
    from: mockFrom,
  }),
}));

describe("enqueueDeferredQuotaOperation atomic rpc", () => {
  beforeEach(() => {
    atomicMock = createAtomicEnqueueRpcMock();
    mockFrom.mockReset();
  });

  it("uses rpc enqueue without table read-modify-write", async () => {
    const id = await enqueueDeferredQuotaOperation({
      operationType: "candidate_discovery",
      estimatedUnits: 60,
      priority: 60,
      reason: "insufficient_dynamic_budget",
    });

    expect(id).toBe("defer-1");
    expect(atomicMock.rpc).toHaveBeenCalledTimes(1);
    expect(atomicMock.rpc).toHaveBeenCalledWith("enqueue_quota_deferred_operation", {
      p_operation_type: "candidate_discovery",
      p_payload: {},
      p_estimated_units: 60,
      p_priority: 60,
      p_reason: "insufficient_dynamic_budget",
      p_retry_after: expect.any(String),
      p_max_attempts: 48,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns null when rpc marks the operation cancelled", async () => {
    await withMaxDeferAttempts(2, async () => {
      atomicMock = createAtomicEnqueueRpcMock();

      await enqueueDeferredQuotaOperation({
        operationType: "watchlist_discovery",
        estimatedUnits: 60,
        priority: 90,
        reason: "insufficient_dynamic_budget",
      });

      const id = await enqueueDeferredQuotaOperation({
        operationType: "watchlist_discovery",
        estimatedUnits: 60,
        priority: 90,
        reason: "insufficient_dynamic_budget",
      });

      expect(id).toBeNull();
      expect(atomicMock.pendingCount()).toBe(0);
    });
  });
});

describe("enqueueDeferredQuotaOperation concurrent enqueue", () => {
  beforeEach(() => {
    atomicMock = createAtomicEnqueueRpcMock();
    mockFrom.mockReset();
  });

  it("keeps a single pending row and increments attempt_count for parallel defers", async () => {
    const concurrency = 25;
    const ids = await Promise.all(
      Array.from({ length: concurrency }, () =>
        enqueueDeferredQuotaOperation({
          operationType: "measurement_run",
          estimatedUnits: 1,
          priority: 80,
          reason: "insufficient_dynamic_budget",
        }),
      ),
    );

    const nonNullIds = ids.filter((id): id is string => id !== null);
    expect(nonNullIds).toHaveLength(concurrency);
    expect(new Set(nonNullIds).size).toBe(1);
    expect(atomicMock.pendingCount()).toBe(1);
    expect(atomicMock.pendingByOperation.get("measurement_run")?.attempt_count).toBe(
      concurrency,
    );
    expect(atomicMock.rpc).toHaveBeenCalledTimes(concurrency);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("handles parallel enqueue near max_attempts boundary", async () => {
    await withMaxDeferAttempts(3, async () => {
      atomicMock = createAtomicEnqueueRpcMock();

      const ids = await Promise.all(
        Array.from({ length: 3 }, () =>
          enqueueDeferredQuotaOperation({
            operationType: "candidate_discovery",
            estimatedUnits: 60,
            priority: 60,
            reason: "insufficient_dynamic_budget",
          }),
        ),
      );

      expect(ids.filter((id) => id !== null)).toHaveLength(2);
      expect(ids.at(-1)).toBeNull();
      expect(atomicMock.pendingCount()).toBe(0);
    });
  });
});
