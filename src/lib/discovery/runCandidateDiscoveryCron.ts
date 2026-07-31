import { runCandidateDiscoveryEngine } from "@/lib/discovery/candidateDiscoveryEngine";
import type { CandidateDiscoveryEngineResult } from "@/lib/discovery/candidateDiscoveryEngine";
import { discoveryRunIndex } from "@/lib/discovery/categoryStrategy";
import { runQuotaGatedOperation } from "@/lib/quota/quotaGatedCron";
import { estimateCandidateDiscoveryQuotaForCron } from "@/lib/quota/quotaOperationEstimates";

export interface CandidateDiscoveryCronResult {
  candidateDiscovery: CandidateDiscoveryEngineResult | null;
  collectedAt: string;
  quotaStatus: "executed" | "deferred" | "skipped";
  quotaReason: string;
}

export async function runCandidateDiscoveryCron(): Promise<CandidateDiscoveryCronResult> {
  const runIndex = discoveryRunIndex();
  const gated = await runQuotaGatedOperation({
    operationType: "candidate_discovery",
    estimateUnits: () => estimateCandidateDiscoveryQuotaForCron(runIndex),
    execute: () => runCandidateDiscoveryEngine(runIndex),
    payload: { runIndex },
  });

  return {
    candidateDiscovery: gated.result ?? null,
    collectedAt: new Date().toISOString(),
    quotaStatus: gated.status,
    quotaReason: gated.authorization.reason,
  };
}
