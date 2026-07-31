import { describe, expect, it } from "vitest";

import {
  computeWebsubHubSignature,
  verifyWebsubHubSignature,
} from "@/lib/websub/websubSignature";

describe("websubSignature", () => {
  const body = "<feed><entry/></feed>";
  const secret = "test-secret";

  it("computes sha1 HMAC digest", () => {
    const digest = computeWebsubHubSignature(body, secret);
    expect(digest).toMatch(/^[a-f0-9]{40}$/);
  });

  it("verifies valid X-Hub-Signature headers", () => {
    const digest = computeWebsubHubSignature(body, secret);
    expect(verifyWebsubHubSignature(body, `sha1=${digest}`, secret)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(verifyWebsubHubSignature(body, "sha1=deadbeef", secret)).toBe(false);
    expect(verifyWebsubHubSignature(body, null, secret)).toBe(false);
  });
});
