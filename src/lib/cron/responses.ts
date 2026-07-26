import { NextRequest, NextResponse } from "next/server";

import { verifyCronSecret } from "@/lib/cron/auth";

export function unauthorizedCronResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function assertCronAuthorized(request: NextRequest): NextResponse | null {
  if (!verifyCronSecret(request)) {
    return unauthorizedCronResponse();
  }

  return null;
}
