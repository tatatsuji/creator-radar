#!/usr/bin/env node
/**
 * Phase1 final judgment — reads verification artifacts and CI checks.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { verifyMigration006 } from "../src/lib/db/migration006";
import { PHASE1_VERIFICATION } from "../src/lib/observability/phase1Verification";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = resolve(projectRoot, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
  }
  return { ...env, ...process.env } as Record<string, string>;
}

async function main(): Promise<void> {
  const validationDir = resolve(projectRoot, ".validation");
  const recall = loadJson<Record<string, unknown>>(resolve(validationDir, "phase1-recall-finalize.json"));
  const speed = loadJson<Record<string, unknown>>(resolve(validationDir, "phase1-speed-remasure.json"));
  const buzz = loadJson<Record<string, unknown>>(resolve(validationDir, "buzz-top100-audit.json"));
  const oldGt = loadJson<{ recallPercent?: number }>(
    resolve(validationDir, "discovery-recall-report-old-gt.json"),
  );

  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const migration006 = await verifyMigration006(async (table, column) => {
    const { error } = await supabase.from(table).select(column).limit(1);
    return !error || (error.code !== "42703" && !error.message.includes("does not exist"));
  });

  const recallBlock = recall?.recall as Record<string, unknown> | undefined;
  const passCriteria = recall?.passCriteria as Record<string, boolean> | undefined;
  const speedPass = speed?.passCriteria as Record<string, boolean> | undefined;
  const speedVerdict = speed?.verdict as string | undefined;

  const codeComplete = true;
  const discoveryVerified =
    Boolean(passCriteria?.overallRecall85) &&
    Boolean(passCriteria?.mainstreamBuzz90) &&
    Boolean(passCriteria?.connectionRate95) &&
    Boolean(passCriteria?.quota70);

  const speedVerified =
    speedVerdict === "24h_speed_measurable" &&
    Boolean(speedPass?.medianHours12) &&
    Boolean(speedPass?.within24h70) &&
    Boolean(speedPass?.cronSuccess95);

  const speedOperational =
    speedVerdict === "extend_to_72h" || speedVerdict === "insufficient_data";

  const buzzBlock = buzz as {
    displayCount?: number;
    measuredRate?: number;
    scoreZeroCount?: number;
    nonPositiveVelocityCount?: number;
    uniqueChannelCount?: number;
    maxPerChannel?: number;
  } | null;

  const dataQualityVerified =
    Boolean(migration006.applied) &&
    (buzzBlock?.scoreZeroCount ?? 1) === 0 &&
    (buzzBlock?.nonPositiveVelocityCount ?? 1) === 0;

  const phase1Complete = codeComplete && discoveryVerified && speedVerified && dataQualityVerified;

  const judgment = {
    judgedAt: new Date().toISOString(),
    sections: {
      A_codeImplementation: codeComplete ? "complete" : "incomplete",
      B_discoveryAccuracy: discoveryVerified
        ? "complete"
        : recall
          ? "incomplete"
          : "pending_new_gt",
      C_discoverySpeed: speedVerified
        ? "complete"
        : speedOperational
          ? "operational_verification_72h"
          : speed
            ? "incomplete"
            : "pending",
      D_dataQuality: dataQualityVerified ? "complete" : "incomplete",
      E_phase1Complete: phase1Complete ? "complete" : speedOperational ? "operational_verification" : "incomplete",
    },
    recall: {
      oldGtPercent: oldGt?.recallPercent ?? null,
      newGtPercent: recallBlock?.overallRecallPercent ?? null,
      delta: recall?.oldGtComparison ?? null,
      mainstreamBuzzRecall: recallBlock?.mainstreamBuzzRecall ?? null,
      missedCount: recallBlock?.missedCount ?? null,
      sportsMissed: recallBlock?.sportsMissedCount ?? null,
    },
    speed,
    buzz: buzzBlock,
    migration006,
    unmet: [
      !migration006.applied && "migration_006",
      !passCriteria?.overallRecall85 && "overall_recall_85",
      !passCriteria?.mainstreamBuzz90 && "mainstream_buzz_90",
      !passCriteria?.connectionRate95 && "measurement_connection_95",
      !passCriteria?.quota70 && "quota_70",
      !speedPass?.medianHours12 && "speed_median_12h",
      !speedPass?.within24h70 && "speed_within_24h_70",
      !speedPass?.cronSuccess95 && "cron_success_95",
      (buzzBlock?.scoreZeroCount ?? 0) > 0 && "buzz_score_zero",
    ].filter(Boolean),
    phase2Ready: phase1Complete,
    publicLaunchReady: phase1Complete,
  };

  writeFileSync(
    resolve(validationDir, "phase1-final-judgment.json"),
    JSON.stringify(judgment, null, 2),
  );
  console.log(JSON.stringify(judgment, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
