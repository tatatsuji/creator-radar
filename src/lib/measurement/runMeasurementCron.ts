import { runMeasurement } from "@/lib/measurement/runMeasurement";
import type { MeasurementRunResult } from "@/lib/measurement/runMeasurement";
import { runQuotaGatedOperation } from "@/lib/quota/quotaGatedCron";
import { estimateMeasurementQuotaForCron } from "@/lib/quota/quotaOperationEstimates";

export interface MeasurementCronResult {
  measurement: MeasurementRunResult | null;
  collectedAt: string;
  quotaStatus: "executed" | "deferred" | "skipped";
  quotaReason: string;
}

export async function runMeasurementCron(): Promise<MeasurementCronResult> {
  const gated = await runQuotaGatedOperation({
    operationType: "measurement_run",
    estimateUnits: estimateMeasurementQuotaForCron,
    execute: runMeasurement,
  });

  return {
    measurement: gated.result ?? null,
    collectedAt: new Date().toISOString(),
    quotaStatus: gated.status,
    quotaReason: gated.authorization.reason,
  };
}
