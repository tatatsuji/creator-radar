import { NextRequest, NextResponse } from "next/server";

import {
  isAdminSecretConfigured,
  verifyAdminSecret,
} from "@/lib/admin/auth";
import { loadObservabilityStatus } from "@/lib/observability/status";
import { isSupabaseConfigured } from "@/lib/supabase/server";

function unauthorizedAdminResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!isAdminSecretConfigured()) {
    return NextResponse.json(
      {
        error:
          "ADMIN_SECRET is not configured. Add ADMIN_SECRET to .env.local for admin observability access.",
      },
      { status: 500 },
    );
  }

  if (!verifyAdminSecret(request)) {
    return unauthorizedAdminResponse();
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
    const status = await loadObservabilityStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load observability status.",
      },
      { status: 500 },
    );
  }
}
