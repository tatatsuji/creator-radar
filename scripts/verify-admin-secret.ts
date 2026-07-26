#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

async function waitForServer(baseUrl: string): Promise<void> {
  for (let index = 0; index < 30; index += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok || response.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  throw new Error(`Dev server not ready at ${baseUrl}`);
}

function responseContainsSecret(
  body: unknown,
  secret: string,
): boolean {
  const serialized = JSON.stringify(body);
  return serialized.includes(secret);
}

async function main(): Promise<void> {
  const envPath = resolve(projectRoot, ".env.local");
  const env = loadEnvFile(envPath);
  const adminSecret = env.ADMIN_SECRET;
  const baseUrl = "http://localhost:3000";

  if (!adminSecret) {
    console.error(
      "ADMIN_SECRET is not configured. Add ADMIN_SECRET to .env.local, restart dev server, then rerun this script.",
    );
    process.exit(1);
  }

  let devServer: ReturnType<typeof import("node:child_process").spawn> | null =
    null;
  let startedDevServer = false;

  try {
    const ready = await fetch(baseUrl)
      .then((response) => response.ok || response.status === 404)
      .catch(() => false);

    if (!ready) {
      const { spawn } = await import("node:child_process");
      devServer = spawn("npm", ["run", "dev"], {
        cwd: projectRoot,
        stdio: "ignore",
        env: { ...process.env, ...env },
      });
      startedDevServer = true;
      await waitForServer(baseUrl);
    }

    const missingSecretResponse = await fetch(
      `${baseUrl}/api/admin/observability/status`,
    );
    console.log(`missing ADMIN header status=${missingSecretResponse.status}`);
    await missingSecretResponse.json();
    if (missingSecretResponse.status !== 401) {
      throw new Error("Expected 401 when Authorization header is missing");
    }

    const invalidResponse = await fetch(
      `${baseUrl}/api/admin/observability/status`,
      {
        headers: { Authorization: "Bearer invalid-admin-secret-value" },
      },
    );
    const invalidBody = await invalidResponse.json();
    console.log(`invalid secret status=${invalidResponse.status}`);
    if (invalidResponse.status !== 401) {
      throw new Error("Expected 401 for invalid ADMIN_SECRET");
    }
    if (responseContainsSecret(invalidBody, adminSecret)) {
      throw new Error("Invalid auth response leaked ADMIN_SECRET");
    }

    const validResponse = await fetch(
      `${baseUrl}/api/admin/observability/status`,
      {
        headers: { Authorization: `Bearer ${adminSecret}` },
      },
    );
    const validBody = await validResponse.json();
    console.log(`valid secret status=${validResponse.status}`);
    if (validResponse.status !== 200) {
      throw new Error("Expected 200 for valid ADMIN_SECRET");
    }
    if (!validBody.health || !validBody.measurement) {
      throw new Error("Authorized response missing observability payload");
    }
    if (responseContainsSecret(validBody, adminSecret)) {
      throw new Error("Authorized response leaked ADMIN_SECRET");
    }

    console.log("ADMIN_SECRET live verification passed.");
  } finally {
    if (startedDevServer && devServer?.pid) {
      devServer.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
