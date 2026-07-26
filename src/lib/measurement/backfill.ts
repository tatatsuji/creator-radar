import {
  listUnscheduledCandidateVideoIds,
  upsertSchedulesBatch,
} from "@/lib/measurement/scheduleRepository";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export interface MeasurementBackfillSummary {
  dryRun: boolean;
  candidateVideoIds: number;
  toCreate: number;
  created: number;
  exists: number;
  failed: number;
  videoIds: string[];
}

export async function backfillMeasurementSchedules(options: {
  dryRun?: boolean;
} = {}): Promise<MeasurementBackfillSummary> {
  if (!options.dryRun && !isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const videoIds = isSupabaseConfigured()
    ? await listUnscheduledCandidateVideoIds()
    : [];

  const summary: MeasurementBackfillSummary = {
    dryRun: options.dryRun ?? false,
    candidateVideoIds: videoIds.length,
    toCreate: videoIds.length,
    created: 0,
    exists: 0,
    failed: 0,
    videoIds,
  };

  if (options.dryRun || videoIds.length === 0) {
    return summary;
  }

  const result = await upsertSchedulesBatch(videoIds);
  summary.created = result.created;
  summary.exists = result.exists;
  summary.failed = result.failed;

  return summary;
}

export function formatMeasurementBackfillSummary(
  summary: MeasurementBackfillSummary,
): string {
  return [
    `Measurement backfill ${summary.dryRun ? "(dry-run)" : "(apply)"}`,
    `Candidate videos without schedule: ${summary.candidateVideoIds}`,
    `To create: ${summary.toCreate}`,
    `Created: ${summary.created}`,
    `Already existed: ${summary.exists}`,
    `Failed: ${summary.failed}`,
  ].join("\n");
}
