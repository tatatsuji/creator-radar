import { markSchedulesDueForDevRemeasure } from "@/lib/measurement/scheduleRepository";

export function assertDevForceRemeasureAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev force remeasure is not allowed when NODE_ENV=production.");
  }

  if (process.env.MEASUREMENT_FORCE_DEV !== "1") {
    throw new Error(
      "Set MEASUREMENT_FORCE_DEV=1 in .env.local (or inline) to run dev force remeasure.",
    );
  }
}

export async function forceDevRemeasureDueNow(
  limit?: number,
): Promise<{ updated: number; videoIds: string[] }> {
  assertDevForceRemeasureAllowed();
  return markSchedulesDueForDevRemeasure(limit);
}
