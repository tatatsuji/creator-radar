import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DB_CHECK_CONSTRAINT_VALUES } from "@/types/observability";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/003_phase1_observability_foundation.sql",
);

const SHORTS_GENRE_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/007_ranking_snapshots_shorts_genre.sql",
);

const ADAPTIVE_MEASUREMENT_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/012_adaptive_measurement_tiers.sql",
);

function readMigrationSql(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

function readAdaptiveMeasurementMigrationSql(): string {
  return readFileSync(ADAPTIVE_MEASUREMENT_MIGRATION_PATH, "utf8");
}

function readMeasurementTierMigrationSql(): string {
  return readMigrationSql() + readAdaptiveMeasurementMigrationSql();
}

describe("migration CHECK alignment", () => {
  const sql = readMigrationSql();

  it("includes every watch tier in CHECK constraints", () => {
    for (const tier of DB_CHECK_CONSTRAINT_VALUES.watch_tier) {
      expect(sql).toContain(`'${tier}'`);
    }
  });

  it("includes every watch status in CHECK constraints", () => {
    for (const status of DB_CHECK_CONSTRAINT_VALUES.watch_status) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("includes every measurement tier and status in CHECK constraints", () => {
    const measurementTierSql = readMeasurementTierMigrationSql();
    for (const tier of DB_CHECK_CONSTRAINT_VALUES.measurement_tier) {
      expect(measurementTierSql).toContain(`'${tier}'`);
    }
    for (const status of DB_CHECK_CONSTRAINT_VALUES.measurement_status) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("includes every discovery run status in CHECK constraints", () => {
    for (const status of DB_CHECK_CONSTRAINT_VALUES.discovery_run_status) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("includes every ranking period and genre in CHECK constraints", () => {
    const genreSql =
      readMigrationSql() + readFileSync(SHORTS_GENRE_MIGRATION_PATH, "utf8");

    for (const period of DB_CHECK_CONSTRAINT_VALUES.ranking_period) {
      expect(readMigrationSql()).toContain(`'${period}'`);
    }
    for (const genre of DB_CHECK_CONSTRAINT_VALUES.genre) {
      expect(genreSql).toContain(`'${genre}'`);
    }
  });

  it("uses default score and algorithm versions in migration", () => {
    expect(sql).toContain(
      `default '${DB_CHECK_CONSTRAINT_VALUES.score_version_default}'`,
    );
    expect(sql).toContain(
      `default '${DB_CHECK_CONSTRAINT_VALUES.discovery_algorithm_version_default}'`,
    );
  });

  it("uses the approved ranking snapshot unique constraint", () => {
    expect(sql).toContain(
      "on public.ranking_snapshots (batch_id, period, genre, video_id)",
    );
  });

  it("does not add derived metrics to video_snapshots", () => {
    expect(sql).not.toContain("alter table public.video_snapshots");
  });

  it("adds last_observed_at without altering last_seen_at", () => {
    expect(sql).toContain("add column if not exists last_observed_at timestamptz");
    expect(sql).not.toContain("add column if not exists last_seen_at");
    expect(sql).not.toContain("drop column if exists last_seen_at");
  });

  it("enables RLS and revokes view access from anon/authenticated", () => {
    expect(sql).toContain(
      "alter table public.channel_watchlist enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.v_observability_watchlist_summary from anon, authenticated",
    );
  });
});
