import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/responses";
import { collectVideoSnapshots } from "@/lib/snapshots/collect";
import { isSupabaseConfigured } from "@/lib/supabase/server";

async function handleSnapshotCron(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase が未設定です。NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。",
      },
      { status: 500 },
    );
  }

  try {
    const result = await collectVideoSnapshots();
    return NextResponse.json({
      ...result,
      collectedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "スナップショット収集に失敗しました。",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSnapshotCron(request);
}

export async function POST(request: NextRequest) {
  return handleSnapshotCron(request);
}
