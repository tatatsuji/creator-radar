export {
  QUOTA_MANAGER_CONFIG,
  QUOTA_OPERATION_PRIORITY,
  QUOTA_OPERATION_RESERVE_POOL,
  QUOTA_OPERATION_TYPES,
  generalDailyBudgetUnits,
  isQuotaOperationType,
  totalReserveBudgetUnits,
  type QuotaOperationType,
  type QuotaReservePool,
} from "@/lib/quota/quotaManagerConfig";
export {
  authorizeQuotaConsumption,
  buildQuotaBudgetSnapshot,
  logQuotaAuthorization,
  resolveQuotaBudgetWindow,
  type QuotaAuthorizationResult,
  type QuotaBudgetSnapshot,
  type QuotaDecision,
} from "@/lib/quota/quotaManager";
export {
  computeDeferredTerminalCleanupCutoff,
  computeDynamicHourlyAllowance,
  computeDynamicQuotaAvailability,
  isDeferredQuotaOperationExpired,
  resolveDeferredEnqueueUpsert,
  resolveDeferredRetryUpsert,
} from "@/lib/quota/quotaManagerLogic";
export {
  enqueueDeferredQuotaOperation,
  listDueDeferredQuotaOperations,
  markDeferredQuotaOperationCompleted,
  rescheduleDeferredQuotaOperation,
  isDeferredQuotaOperationExpired as isDeferredQuotaOperationExpiredFromQueue,
  computeDeferredTerminalCleanupCutoff as computeDeferredTerminalCleanupCutoffFromQueue,
  type QuotaDeferredOperationRow,
} from "@/lib/quota/quotaDeferredQueue";
export {
  runQuotaGatedOperation,
  requestQuotaAuthorization,
  type QuotaGatedCronResult,
} from "@/lib/quota/quotaGatedCron";
export {
  estimateCandidateDiscoveryQuotaUnits,
  estimateMeasurementQuotaForCron,
  estimateMeasurementRunQuotaUnits,
  estimateWatchlistDiscoveryQuotaForCron,
  estimateWatchlistDiscoveryQuotaUnits,
} from "@/lib/quota/quotaOperationEstimates";
export { loadQuotaUsageTotals } from "@/lib/quota/quotaUsageLedger";

/**
 * Extension points reserved for future phases:
 * - WebSub-triggered operations via emergency_discovery reserve pool
 * - Dynamic priority overrides (PriorityProvider interface)
 * - Quota learning from historical run metadata (QuotaLearningProvider)
 * - Multi-key routing (ApiKeyQuotaProvider)
 */

export interface QuotaProviderExtensionPoints {
  priorityOverride?: (operationType: string) => number | null;
  apiKeyId?: string;
  learningAdjustment?: (operationType: string, estimatedUnits: number) => number;
}
