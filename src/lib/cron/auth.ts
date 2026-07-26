import type { NextRequest } from "next/server";

import { verifyBearerSecret } from "@/lib/auth/bearerSecret";

export function verifyCronSecret(request: NextRequest): boolean {
  return verifyBearerSecret(request, process.env.CRON_SECRET);
}

export function isCronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}
