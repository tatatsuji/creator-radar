import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Migration006Status {
  applied: boolean;
  missing: string[];
}

export async function verifyMigration006(
  probeColumn: (table: string, column: string) => Promise<boolean>,
): Promise<Migration006Status> {
  const checks = [
    ["videos", "description"],
    ["videos", "view_count"],
    ["videos", "like_count"],
    ["videos", "comment_count"],
    ["videos", "tags"],
    ["videos", "content_features"],
    ["channels", "subscriber_count"],
  ] as const;

  const missing: string[] = [];
  for (const [table, column] of checks) {
    if (!(await probeColumn(table, column))) {
      missing.push(`${table}.${column}`);
    }
  }

  return { applied: missing.length === 0, missing };
}

export function getMigration006Sql(projectRoot: string): string {
  return readFileSync(
    resolve(projectRoot, "supabase/migrations/006_phase1_candidate_enrichment.sql"),
    "utf8",
  );
}

export async function applyMigration006WithPostgres(input: {
  connectionString: string;
  projectRoot: string;
}): Promise<void> {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: input.connectionString });
  await client.connect();
  try {
    await client.query(getMigration006Sql(input.projectRoot));
  } finally {
    await client.end();
  }
}

export function buildSupabasePostgresConnectionString(env: {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_DB_PASSWORD?: string;
  SUPABASE_DB_URL?: string;
}): string | null {
  if (env.SUPABASE_DB_URL) {
    return env.SUPABASE_DB_URL;
  }

  const password = env.SUPABASE_DB_PASSWORD;
  if (!password) {
    return null;
  }

  const match = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    return null;
  }

  const projectRef = match[1];
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
}
