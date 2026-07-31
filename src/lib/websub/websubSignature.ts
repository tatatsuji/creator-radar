import { createHmac, timingSafeEqual } from "node:crypto";

export function computeWebsubHubSignature(body: string, secret: string): string {
  return createHmac("sha1", secret).update(body, "utf8").digest("hex");
}

export function verifyWebsubHubSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha1=") || secret.length === 0) {
    return false;
  }

  const provided = signatureHeader.slice("sha1=".length).trim();
  const expected = computeWebsubHubSignature(body, secret);

  if (provided.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}
