import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildWebsubNotificationDedupKey,
  DB_CHECK_CONSTRAINT_VALUES,
} from "@/types/observability";

const MIGRATION_016_PATH = path.join(
  process.cwd(),
  "supabase/migrations/016_websub_foundation.sql",
);

describe("websub foundation migration", () => {
  const migration = readFileSync(MIGRATION_016_PATH, "utf8");

  it("creates websub_subscriptions with status and health checks", () => {
    expect(migration).toContain("create table if not exists public.websub_subscriptions");
    for (const status of DB_CHECK_CONSTRAINT_VALUES.websub_subscription_status) {
      expect(migration).toContain(`'${status}'`);
    }
    for (const health of DB_CHECK_CONSTRAINT_VALUES.websub_subscription_health) {
      expect(migration).toContain(`'${health}'`);
    }
  });

  it("creates websub_notification_log with dedup_key unique constraint", () => {
    expect(migration).toContain("create table if not exists public.websub_notification_log");
    expect(migration).toContain(
      "constraint websub_notification_log_dedup_key_unique unique (dedup_key)",
    );
    expect(migration).toContain(
      "create unique index if not exists websub_notification_log_topic_video_unique",
    );
    for (const status of DB_CHECK_CONSTRAINT_VALUES.websub_notification_status) {
      expect(migration).toContain(`'${status}'`);
    }
  });

  it("defines enqueue_websub_notification with terminal status preservation", () => {
    expect(migration).toContain("create or replace function public.enqueue_websub_notification");
    expect(migration).toContain("p_topic_url || '::' || p_youtube_video_id");
    expect(migration).toContain(
      "when websub_notification_log.status in ('processed', 'skipped_known', 'duplicate')",
    );
    expect(migration).toContain("when websub_notification_log.status = 'failed'");
    expect(migration).toContain("then 'pending'");
  });

  it("defines claim_websub_notifications with skip locked and processing lease", () => {
    expect(migration).toContain("create or replace function public.claim_websub_notifications");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("processing_expires_at = now() + make_interval");
  });

  it("defines complete and reclaim RPCs", () => {
    expect(migration).toContain("create or replace function public.complete_websub_notification");
    expect(migration).toContain(
      "create or replace function public.reclaim_stale_websub_notifications",
    );
  });

  it("enables RLS and grants RPC execute to service_role only", () => {
    expect(migration).toContain(
      "alter table public.websub_subscriptions enable row level security",
    );
    expect(migration).toContain(
      "revoke all on public.websub_notification_log from anon, authenticated",
    );
    expect(migration).toContain("grant execute on function public.enqueue_websub_notification");
    expect(migration).toContain("to service_role");
  });
});

describe("buildWebsubNotificationDedupKey", () => {
  it("joins topic and video id with double colon", () => {
    expect(
      buildWebsubNotificationDedupKey(
        "https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123",
        "abc123",
      ),
    ).toBe("https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123::abc123");
  });
});
