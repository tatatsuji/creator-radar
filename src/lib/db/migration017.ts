export interface Migration017Status {
  applied: boolean;
  missing: string[];
}

export const MIGRATION_017_SQL_PATH =
  "supabase/migrations/017_video_format_live_state.sql";

export const MIGRATION_017_CHECKS = [
  ["videos", "video_format"],
  ["videos", "live_state"],
  ["videos", "live_broadcast_content"],
  ["videos", "live_scheduled_start_at"],
  ["videos", "live_actual_start_at"],
  ["videos", "live_actual_end_at"],
  ["videos", "live_metadata_fetch_status"],
  ["videos", "live_metadata_checked_at"],
  ["videos", "format_signals"],
] as const;

export async function verifyMigration017(
  probeColumn: (table: string, column: string) => Promise<boolean>,
): Promise<Migration017Status> {
  const missing: string[] = [];
  for (const [table, column] of MIGRATION_017_CHECKS) {
    if (!(await probeColumn(table, column))) {
      missing.push(`${table}.${column}`);
    }
  }
  return { applied: missing.length === 0, missing };
}

export function formatMigration017SqlEditorInstructions(projectRoot: string): string {
  return [
    "Migration 017 is not applied yet.",
    "",
    "Apply via Supabase SQL Editor:",
    "1. Open Supabase Dashboard → SQL Editor → New query",
    `2. Paste the full contents of ${MIGRATION_017_SQL_PATH}`,
    "3. Run the query (expects success / no errors)",
    "4. Re-run: npm run db:verify:017",
    "",
    `Absolute path: ${projectRoot}/${MIGRATION_017_SQL_PATH}`,
  ].join("\n");
}
