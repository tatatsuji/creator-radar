import {
  authorizeQuotaConsumption,
  logQuotaAuthorization,
  type QuotaAuthorizationResult,
} from "@/lib/quota/quotaManager";
import {
  enqueueDeferredQuotaOperation,
  listDueDeferredQuotaOperations,
  markDeferredQuotaOperationCompleted,
  rescheduleDeferredQuotaOperation,
} from "@/lib/quota/quotaDeferredQueue";
import {
  QUOTA_MANAGER_CONFIG,
  QUOTA_OPERATION_PRIORITY,
  type QuotaOperationType,
} from "@/lib/quota/quotaManagerConfig";

export interface QuotaGatedCronResult<T> {
  status: "executed" | "deferred" | "skipped";
  operationType: QuotaOperationType;
  authorization: QuotaAuthorizationResult;
  deferredOperationId?: string | null;
  result?: T;
}

export async function runQuotaGatedOperation<T>(input: {
  operationType: QuotaOperationType;
  estimateUnits: () => Promise<number>;
  execute: () => Promise<T>;
  payload?: Record<string, unknown>;
  processDeferredFirst?: boolean;
}): Promise<QuotaGatedCronResult<T>> {
  if (input.processDeferredFirst !== false) {
    const dueDeferred = await listDueDeferredQuotaOperations(input.operationType, 1);
    if (dueDeferred.length > 0) {
      const deferred = dueDeferred[0];
      const authorization = await authorizeQuotaConsumption({
        operationType: input.operationType,
        estimatedUnits: deferred.estimated_units,
      });
      logQuotaAuthorization(authorization);

      if (authorization.decision === "defer") {
        await rescheduleDeferredQuotaOperation({
          id: deferred.id,
          reason: authorization.reason,
          retryAfter: authorization.retryAfter
            ? new Date(authorization.retryAfter)
            : undefined,
        });
        return {
          status: "deferred",
          operationType: input.operationType,
          authorization,
          deferredOperationId: deferred.id,
        };
      }

      const result = await input.execute();
      await markDeferredQuotaOperationCompleted(deferred.id);
      return {
        status: "executed",
        operationType: input.operationType,
        authorization,
        deferredOperationId: deferred.id,
        result,
      };
    }
  }

  const estimatedUnits = await input.estimateUnits();
  const authorization = await authorizeQuotaConsumption({
    operationType: input.operationType,
    estimatedUnits,
  });
  logQuotaAuthorization(authorization);

  if (authorization.decision === "defer") {
    const deferredOperationId = await enqueueDeferredQuotaOperation({
      operationType: input.operationType,
      estimatedUnits,
      priority: QUOTA_OPERATION_PRIORITY[input.operationType],
      reason: authorization.reason,
      payload: input.payload,
      retryAfter: authorization.retryAfter
        ? new Date(authorization.retryAfter)
        : undefined,
    });

    return {
      status: "deferred",
      operationType: input.operationType,
      authorization,
      deferredOperationId,
    };
  }

  const result = await input.execute();

  return {
    status: "executed",
    operationType: input.operationType,
    authorization,
    result,
  };
}

export async function requestQuotaAuthorization(input: {
  operationType: QuotaOperationType;
  estimatedUnits: number;
}): Promise<QuotaAuthorizationResult> {
  const authorization = await authorizeQuotaConsumption(input);
  logQuotaAuthorization(authorization);
  return authorization;
}

export { QUOTA_MANAGER_CONFIG };
