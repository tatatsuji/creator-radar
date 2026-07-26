import type { NextRequest } from "next/server";

import {
  isSecretConfigured,
  verifyBearerSecret,
} from "@/lib/auth/bearerSecret";

export function verifyAdminSecret(request: NextRequest): boolean {
  return verifyBearerSecret(request, process.env.ADMIN_SECRET);
}

export function isAdminSecretConfigured(): boolean {
  return isSecretConfigured(process.env.ADMIN_SECRET);
}
