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

async function callCron(
  baseUrl: string,
  path: string,
  cronSecret: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function callAdminStatus(
  baseUrl: string,
  adminSecret: string | undefined,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/api/admin/observability/status`, {
    headers: adminSecret
      ? { Authorization: `Bearer ${adminSecret}` }
      : undefined,
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

async function countActiveLocks(): Promise<number> {
  const { createClient } = await import("@supabase/supabase-js");
  const env = loadEnvFile(resolve(projectRoot, ".env.local"));
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("measurement_schedule")
    .select("video_id, locked_until")
    .not("lock_token", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).filter(
    (row) => row.locked_until && row.locked_until > nowIso,
  ).length;
}

async function main(): Promise<void> {
  console.log("=== Phase 2.5 automation verification ===");

  const env = loadEnvFile(resolve(projectRoot, ".env.local"));
  const cronSecret = env.CRON_SECRET;
  const adminSecret = env.ADMIN_SECRET;
  const baseUrl = "http://localhost:3000";

  if (!cronSecret) {
    throw new Error("CRON_SECRET is not configured in .env.local");
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
        env: process.env,
      });
      startedDevServer = true;
      await waitForServer(baseUrl);
    }

    console.log("\n--- Discovery cron ---");
    console.log(JSON.stringify(await callCron(baseUrl, "/api/cron/discovery", cronSecret), null, 2));

    console.log("\n--- Measurement cron ---");
    console.log(
      JSON.stringify(await callCron(baseUrl, "/api/cron/measurement", cronSecret), null, 2),
    );

    console.log("\n--- Admin API: missing/invalid auth ---");
    if (!adminSecret) {
      const missingSecret = await callAdminStatus(baseUrl, undefined);
      console.log(`status=${missingSecret.status}`);
      console.log(JSON.stringify(missingSecret.body, null, 2));
      if (missingSecret.status !== 500) {
        throw new Error("Expected 500 when ADMIN_SECRET is not configured");
      }
    } else {
      const invalid = await callAdminStatus(baseUrl, "invalid-admin-secret");
      console.log(`invalid status=${invalid.status}`);
      if (invalid.status !== 401) {
        throw new Error("Expected 401 for invalid ADMIN_SECRET");
      }

      console.log("\n--- Admin API: authorized ---");
      const authorized = await callAdminStatus(baseUrl, adminSecret);
      console.log(`status=${authorized.status}`);
      console.log(JSON.stringify(authorized.body, null, 2));
      if (authorized.status !== 200) {
        throw new Error("Expected 200 for valid ADMIN_SECRET");
      }
      if (!authorized.body.health) {
        throw new Error("Expected health payload in admin response");
      }
    }

    console.log("\n--- Lock check ---");
    const activeLocks = await countActiveLocks();
    console.log(JSON.stringify({ activeLocks }, null, 2));
    if (activeLocks > 0) {
      throw new Error(`Expected no active locks after cron runs, found ${activeLocks}`);
    }

    console.log("\n--- Observability status ---");
    const { loadObservabilityStatus } = await import("../src/lib/observability/status");
    const status = await loadObservabilityStatus();
    console.log(JSON.stringify(status, null, 2));

    console.log("\nVerification completed.");
    console.log(
      "Note: measurement dueNow may be 0 immediately after a successful run; this is expected.",
    );

    if (!adminSecret) {
      console.log(
        "Admin authorized check skipped. Add ADMIN_SECRET to .env.local to enable full admin API verification.",
      );
    }
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
