import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getWebsubOperationsEnvironmentStatus,
  WEBSUB_CANARY_MAX_CHANNELS,
  WEBSUB_CRON_JOBS,
  WEBSUB_CRON_NPM_SCRIPTS,
  WEBSUB_CRON_SCHEDULES,
  WEBSUB_ENVIRONMENT_VARIABLES,
} from "@/lib/websub/websubOperationsConfig";
import { WEBSUB_ENABLED } from "@/lib/websub/websubConfig";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github/workflows/websub-cron.yml",
);

describe("WebSub operations config", () => {
  it("keeps WEBSUB_ENABLED default OFF", () => {
    expect(WEBSUB_ENABLED).toBe(false);
  });

  it("documents required environment variables", () => {
    const names = WEBSUB_ENVIRONMENT_VARIABLES.map((entry) => entry.name);
    expect(names).toContain("WEBSUB_ENABLED");
    expect(names).toContain("WEBSUB_HUB_SECRET");
    expect(names).toContain("WEBSUB_APP_DOMAIN");
    expect(names).toContain("WEBSUB_CANARY_MAX_CHANNELS");
  });

  it("defines cron schedules for all WebSub jobs", () => {
    for (const job of WEBSUB_CRON_JOBS) {
      expect(WEBSUB_CRON_SCHEDULES[job]).toBeTruthy();
      expect(WEBSUB_CRON_NPM_SCRIPTS[job]).toMatch(/^cron:websub-/);
    }

    expect(WEBSUB_CRON_SCHEDULES["websub-subscribe-new"]).toBe("0 2 * * *");
    expect(WEBSUB_CRON_SCHEDULES["websub-renew-daily"]).toBe("0 3 * * *");
    expect(WEBSUB_CRON_SCHEDULES["websub-reconcile"]).toBe("0 4 * * *");
    expect(WEBSUB_CRON_SCHEDULES["websub-renew-urgent"]).toBe("0 */6 * * *");
    expect(WEBSUB_CRON_SCHEDULES["websub-process-notifications"]).toBe(
      "*/15 * * * *",
    );
  });

  it("defaults canary channel limit to zero (unlimited when enabled later)", () => {
    expect(WEBSUB_CANARY_MAX_CHANNELS).toBe(0);
  });

  it("reports environment readiness without requiring enablement", () => {
    const status = getWebsubOperationsEnvironmentStatus();
    expect(status.enabled).toBe(false);
    expect(Array.isArray(status.missingWhenEnabled)).toBe(true);
  });
});

describe("WebSub GitHub Actions workflow", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");

  it("defines all WebSub cron jobs", () => {
    for (const job of WEBSUB_CRON_JOBS) {
      expect(workflow).toContain(`${job}:`);
    }
  });

  it("wires npm cron scripts for each job", () => {
    for (const script of Object.values(WEBSUB_CRON_NPM_SCRIPTS)) {
      expect(workflow).toContain(`npm run ${script}`);
    }
  });

  it("passes WEBSUB_ENABLED from secrets", () => {
    expect(workflow).toContain("WEBSUB_ENABLED: ${{ secrets.WEBSUB_ENABLED }}");
  });

  it("includes workflow_dispatch manual trigger", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("websub-process-notifications");
  });
});
