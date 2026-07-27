import { NextRequest, NextResponse } from "next/server";

import {
  isAdminSecretConfigured,
  verifyAdminSecret,
} from "@/lib/admin/auth";
import {
  applyMigration006WithPostgres,
  buildSupabasePostgresConnectionString,
  verifyMigration006,
} from "@/lib/db/migration006";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

async function probeColumn(table: string, column: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
}

export async function GET(request: NextRequest) {
  if (!isAdminSecretConfigured() || !verifyAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const status = await verifyMigration006(probeColumn);
  return NextResponse.json({ migration006: status });
}

export async function POST(request: NextRequest) {
  if (!isAdminSecretConfigured() || !verifyAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const before = await verifyMigration006(probeColumn);
  if (before.applied) {
    return NextResponse.json({ status: "already_applied", migration006: before });
  }

  const connectionString = buildSupabasePostgresConnectionString({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  });

  if (!connectionString) {
    return NextResponse.json(
      {
        status: "blocked",
        error:
          "SUPABASE_DB_PASSWORD or SUPABASE_DB_URL is not configured on the server.",
        missingBefore: before.missing,
        fallbackSqlPath: "supabase/migrations/006_phase1_candidate_enrichment.sql",
      },
      { status: 500 },
    );
  }

  await applyMigration006WithPostgres({
    connectionString,
    projectRoot: process.cwd(),
  });

  const after = await verifyMigration006(probeColumn);
  if (!after.applied) {
    return NextResponse.json(
      {
        status: "failed",
        error: `Migration ran but columns still missing: ${after.missing.join(", ")}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: "applied",
    migration006: after,
    missingBefore: before.missing,
  });
}
