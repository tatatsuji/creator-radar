#!/usr/bin/env node

/**
 * 24-hour Historical Database validation collector.
 * Runs Measurement hourly and Discovery every 6 hours via direct library calls.
 * Does not modify ranking, score, or discovery algorithms.
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const logDir = resolve(projectRoot, ".validation");
const logPath = resolve(logDir, "24h-collection.jsonl");
const statePath = resolve(logDir, "24h-collection-state.json");

const HOUR_MS = 60 * 60 * 1000;
const DISCOVERY_INTERVAL_MS = 6 * HOUR_MS;
const TOTAL_DURATION_MS = 24 * HOUR_MS;

interface CollectionState {
  startedAt: string;
  endsAt: string;
  measurementRuns: number;
  discoveryRuns: number;
  lastMeasurementAt: string | null;
  lastDiscoveryAt: string | null;
  errors: string[];
}

function loadState(): CollectionState | null {
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as CollectionState;
  } catch {
    return null;
  }
}

function saveState(state: CollectionState): void {
  mkdirSync(logDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function appendLog(entry: Record<string, unknown>): void {
  mkdirSync(logDir, { recursive: true });
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
}

async function runMeasurementCycle(): Promise<Record<string, unknown>> {
  const { runMeasurement } = await import("../src/lib/measurement/runMeasurement");
  const result = await runMeasurement();
  return result as unknown as Record<string, unknown>;
}

async function runDiscoveryCycle(): Promise<Record<string, unknown>> {
  const { runWatchlistDiscovery } = await import("../src/lib/discovery/runWatchlistDiscovery");
  const result = await runWatchlistDiscovery();
  return result as unknown as Record<string, unknown>;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function finalizeReport(): Promise<void> {
  const { buildDailyReport } = await import("../src/lib/observability/dailyReport");
  const report = await buildDailyReport();
  const reportPath = resolve(logDir, "24h-final-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("\n=== 24h Final Report ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nSaved to ${reportPath}`);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const finalizeOnly = args.has("--finalize");

  if (finalizeOnly) {
    await finalizeReport();
    return;
  }

  const existing = loadState();
  const now = Date.now();

  if (existing && now < Date.parse(existing.endsAt)) {
    console.log(`Collection already in progress until ${existing.endsAt}`);
    console.log(`Logs: ${logPath}`);
    process.exit(0);
  }

  const startedAt = new Date().toISOString();
  const endsAt = new Date(now + TOTAL_DURATION_MS).toISOString();
  const state: CollectionState = {
    startedAt,
    endsAt,
    measurementRuns: 0,
    discoveryRuns: 0,
    lastMeasurementAt: null,
    lastDiscoveryAt: null,
    errors: [],
  };
  saveState(state);

  console.log("=== 24h Historical Database validation started ===");
  console.log(`Started: ${startedAt}`);
  console.log(`Ends:    ${endsAt}`);
  console.log(`Logs:    ${logPath}`);

  let nextDiscoveryAt = now;

  while (Date.now() < Date.parse(endsAt)) {
    const cycleStarted = new Date().toISOString();

    try {
      if (Date.now() >= nextDiscoveryAt) {
        console.log(`\n[${cycleStarted}] Running Discovery...`);
        const discoveryResult = await runDiscoveryCycle();
        state.discoveryRuns += 1;
        state.lastDiscoveryAt = new Date().toISOString();
        appendLog({
          type: "discovery",
          at: state.lastDiscoveryAt,
          result: discoveryResult,
        });
        nextDiscoveryAt = Date.now() + DISCOVERY_INTERVAL_MS;
      }

      console.log(`\n[${cycleStarted}] Running Measurement...`);
      const measurementResult = await runMeasurementCycle();
      state.measurementRuns += 1;
      state.lastMeasurementAt = new Date().toISOString();
      appendLog({
        type: "measurement",
        at: state.lastMeasurementAt,
        result: measurementResult,
      });
      saveState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.errors.push(message);
      saveState(state);
      appendLog({
        type: "error",
        at: new Date().toISOString(),
        message,
      });
      console.error(`Error: ${message}`);
    }

    const remainingMs = Date.parse(endsAt) - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    const sleepMs = Math.min(HOUR_MS, remainingMs);
    console.log(`Sleeping ${Math.round(sleepMs / 60000)} minutes until next cycle...`);
    await sleep(sleepMs);
  }

  await finalizeReport();
  console.log("\n24h validation collection completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
