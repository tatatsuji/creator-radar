import { NextRequest, NextResponse } from "next/server";

import { runMeasurement } from "@/lib/measurement/runMeasurement";
import { assertCronAuthorized } from "@/lib/cron/responses";
import { isSupabaseConfigured } from "@/lib/supabase/server";

async function handleMeasurementCron(request: NextRequest) {
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
    const result = await runMeasurement();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Measurement run failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleMeasurementCron(request);
}

export async function POST(request: NextRequest) {
  return handleMeasurementCron(request);
}
