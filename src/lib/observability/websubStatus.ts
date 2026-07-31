import { getLatestDiscoveryRun } from "@/lib/discovery/runsRepository";
import {
  getWebsubOperationsEnvironmentStatus,
  WEBSUB_CRON_SCHEDULES,
} from "@/lib/websub/websubOperationsConfig";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export interface WebsubObservabilityStatus {
  environment: ReturnType<typeof getWebsubOperationsEnvironmentStatus>;
  cronSchedules: typeof WEBSUB_CRON_SCHEDULES;
  subscriptions: {
    total: number;
    byStatus: Record<string, number>;
    byHealth: Record<string, number>;
    healthyRate: number | null;
  };
  subscribeOperations: {
    last24Hours: {
      subscribeAttempts: number;
      successCount: number;
      failureCount: number;
      successRate: number | null;
    };
  };
  renewOperations: {
    last24Hours: {
      renewAttempts: number;
      verifiedCount: number;
      successRate: number | null;
    };
  };
  callbacks: {
    last24Hours: {
      verifiedSubscriptions: number;
      pendingVerifyCount: number;
      successRate: number | null;
    };
  };
  notifications: {
    backlogPending: number;
    backlogProcessing: number;
    last24Hours: {
      processed: number;
      failed: number;
      skippedKnown: number;
      duplicate: number;
      quotaUnitsUsed: number;
    };
  };
  watchlistPollFallback: {
    lastRun: {
      channelsSkippedHealthy: number;
      channelsSafetyPoll: number;
      channelsNormalPoll: number;
      collectedAt: string | null;
    } | null;
  };
  checkedAt: string;
}

function emptyCounts(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function incrementCount(
  counts: Record<string, number>,
  key: string,
): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function computeRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(4));
}

function readMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function loadWebsubObservabilityStatus(): Promise<WebsubObservabilityStatus> {
  const environment = getWebsubOperationsEnvironmentStatus();
  const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createSupabaseServerClient();

  const [
    subscriptionsResult,
    notificationsResult,
    notifications24hResult,
    latestWatchlistRun,
  ] = await Promise.all([
    supabase
      .from("websub_subscriptions")
      .select(
        "status,subscription_health,last_subscribe_at,last_verified_at,subscribe_attempt_count",
      ),
    supabase
      .from("websub_notification_log")
      .select("status,quota_units_used")
      .in("status", ["pending", "processing"]),
    supabase
      .from("websub_notification_log")
      .select("status,quota_units_used,updated_at")
      .gte("updated_at", since24Hours),
    getLatestDiscoveryRun(),
  ]);

  if (subscriptionsResult.error) {
    throw new Error(
      `websub_subscriptions observability lookup failed: ${subscriptionsResult.error.message}`,
    );
  }

  if (notificationsResult.error) {
    throw new Error(
      `websub_notification_log backlog lookup failed: ${notificationsResult.error.message}`,
    );
  }

  if (notifications24hResult.error) {
    throw new Error(
      `websub_notification_log 24h lookup failed: ${notifications24hResult.error.message}`,
    );
  }

  const byStatus = emptyCounts([
    "pending",
    "pending_verify",
    "active",
    "renew_failed",
    "expired",
    "unsubscribed",
    "orphaned",
    "dead",
  ]);
  const byHealth = emptyCounts(["healthy", "degraded", "unhealthy"]);

  let subscribeAttempts24h = 0;
  let subscribeSuccess24h = 0;
  let subscribeFailure24h = 0;
  let renewAttempts24h = 0;
  let verified24h = 0;
  let pendingVerifyCount = 0;

  for (const row of subscriptionsResult.data ?? []) {
    incrementCount(byStatus, row.status as string);
    incrementCount(byHealth, row.subscription_health as string);

    if (row.status === "pending_verify") {
      pendingVerifyCount += 1;
    }

    const lastSubscribeAt = row.last_subscribe_at;
    if (lastSubscribeAt && lastSubscribeAt >= since24Hours) {
      subscribeAttempts24h += 1;
      renewAttempts24h += 1;

      if (row.status === "renew_failed") {
        subscribeFailure24h += 1;
      } else if (
        row.status === "pending_verify" ||
        row.status === "active"
      ) {
        subscribeSuccess24h += 1;
      }
    }

    const lastVerifiedAt = row.last_verified_at;
    if (lastVerifiedAt && lastVerifiedAt >= since24Hours) {
      verified24h += 1;
    }
  }

  const totalSubscriptions = subscriptionsResult.data?.length ?? 0;
  const healthyCount = byHealth.healthy ?? 0;

  let backlogPending = 0;
  let backlogProcessing = 0;
  for (const row of notificationsResult.data ?? []) {
    if (row.status === "pending") {
      backlogPending += 1;
    } else if (row.status === "processing") {
      backlogProcessing += 1;
    }
  }

  const notification24h = {
    processed: 0,
    failed: 0,
    skippedKnown: 0,
    duplicate: 0,
    quotaUnitsUsed: 0,
  };

  for (const row of notifications24hResult.data ?? []) {
    notification24h.quotaUnitsUsed += row.quota_units_used ?? 0;

    switch (row.status) {
      case "processed":
        notification24h.processed += 1;
        break;
      case "failed":
        notification24h.failed += 1;
        break;
      case "skipped_known":
        notification24h.skippedKnown += 1;
        break;
      case "duplicate":
        notification24h.duplicate += 1;
        break;
      default:
        break;
    }
  }

  const watchlistMetadata =
    latestWatchlistRun?.run_type === "watchlist_check"
      ? (latestWatchlistRun.metadata as Record<string, unknown> | null)
      : null;

  return {
    environment,
    cronSchedules: WEBSUB_CRON_SCHEDULES,
    subscriptions: {
      total: totalSubscriptions,
      byStatus,
      byHealth,
      healthyRate: computeRate(healthyCount, totalSubscriptions),
    },
    subscribeOperations: {
      last24Hours: {
        subscribeAttempts: subscribeAttempts24h,
        successCount: subscribeSuccess24h,
        failureCount: subscribeFailure24h,
        successRate: computeRate(
          subscribeSuccess24h,
          subscribeSuccess24h + subscribeFailure24h,
        ),
      },
    },
    renewOperations: {
      last24Hours: {
        renewAttempts: renewAttempts24h,
        verifiedCount: verified24h,
        successRate: computeRate(verified24h, renewAttempts24h),
      },
    },
    callbacks: {
      last24Hours: {
        verifiedSubscriptions: verified24h,
        pendingVerifyCount,
        successRate: computeRate(
          verified24h,
          verified24h + pendingVerifyCount,
        ),
      },
    },
    notifications: {
      backlogPending,
      backlogProcessing,
      last24Hours: notification24h,
    },
    watchlistPollFallback: {
      lastRun:
        latestWatchlistRun?.run_type === "watchlist_check"
          ? {
              channelsSkippedHealthy: readMetadataNumber(
                watchlistMetadata,
                "channelsSkippedWebsubHealthy",
              ),
              channelsSafetyPoll: readMetadataNumber(
                watchlistMetadata,
                "channelsSafetyPoll",
              ),
              channelsNormalPoll: readMetadataNumber(
                watchlistMetadata,
                "channelsNormalPoll",
              ),
              collectedAt: latestWatchlistRun.finished_at,
            }
          : null,
    },
    checkedAt: new Date().toISOString(),
  };
}
