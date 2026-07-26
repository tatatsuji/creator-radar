import { NextRequest, NextResponse } from "next/server";

import { runWatchlistDiscovery } from "@/lib/discovery/runWatchlistDiscovery";
import { assertCronAuthorized } from "@/lib/cron/responses";
import { isSupabaseConfigured } from "@/lib/supabase/server";

async function handleDiscoveryCron(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const result = await runWatchlistDiscovery();
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
            : "Watchlist discovery failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleDiscoveryCron(request);
}

export async function POST(request: NextRequest) {
  return handleDiscoveryCron(request);
}
