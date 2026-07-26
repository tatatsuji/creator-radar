import type { NextRequest } from "next/server";

export function verifyBearerSecret(
  request: NextRequest,
  expectedSecret: string | undefined,
): boolean {
  const secret = expectedSecret?.trim();
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export function isSecretConfigured(secret: string | undefined): boolean {
  return Boolean(secret?.trim());
}
