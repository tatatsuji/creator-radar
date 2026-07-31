import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_014_PATH = path.join(
  process.cwd(),
  "supabase/migrations/014_quota_deferred_hardening.sql",
);

const MIGRATION_015_PATH = path.join(
  process.cwd(),
  "supabase/migrations/015_quota_deferred_atomic_enqueue.sql",
);

describe("quota deferred atomic enqueue migration", () => {
  const migration014 = readFileSync(MIGRATION_014_PATH, "utf8");
  const migration015 = readFileSync(MIGRATION_015_PATH, "utf8");

  it("uses migration 014 partial unique index predicate for ON CONFLICT", () => {
    expect(migration014).toContain("where status = 'pending'");
    expect(migration015).toContain(
      "on conflict (operation_type) where (status = 'pending')",
    );
  });

  it("increments attempt_count with SQL expression update", () => {
    expect(migration015).toContain(
      "attempt_count = quota_deferred_operations.attempt_count + 1",
    );
  });

  it("cancels when incremented attempt_count reaches max_attempts", () => {
    expect(migration015).toContain(
      "when quota_deferred_operations.attempt_count + 1 >= quota_deferred_operations.max_attempts",
    );
    expect(migration015).toContain("then 'cancelled'");
  });
});
