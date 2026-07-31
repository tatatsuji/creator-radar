# WebSub Operations Runbook (Phase 2 Step 6A)

Operations foundation is deployed with **`WEBSUB_ENABLED=false` by default**.
Crons and GitHub Actions are wired, but production WebSub stays off until Step 6B canary.

## Architecture

| Layer | Schedule (UTC) | npm script |
|-------|----------------|------------|
| Subscribe new | daily 02:00 | `npm run cron:websub-subscribe-new` |
| Renew urgent | every 6h | `npm run cron:websub-renew-urgent` |
| Renew daily | daily 03:00 | `npm run cron:websub-renew-daily` |
| Reconcile | daily 04:00 | `npm run cron:websub-reconcile` |
| Notification worker | every 15min | `npm run cron:websub-process-notifications` |

GitHub Actions: `.github/workflows/websub-cron.yml`

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEBSUB_ENABLED` | `false` | Master feature flag |
| `WEBSUB_HUB_SECRET` | — | Hub signature + subscribe secret |
| `WEBSUB_APP_DOMAIN` | — | Public domain for callback URL |
| `WEBSUB_CANARY_MAX_CHANNELS` | `0` | Canary cap (0 = unlimited) |
| `WEBSUB_HUB_URL` | Google Hub | Hub endpoint |
| `WEBSUB_SAFETY_POLL_INTERVAL_HOURS` | `24` | Safety poll interval |

Vercel production must also set `WEBSUB_*` for the callback API route.

## Observability

```bash
npm run websub:status
```

Metrics (24h window where applicable):

- Subscribe / renew success rates
- Callback verification count (`last_verified_at`)
- Notification backlog, processed, failed, quota units
- Watchlist poll fallback (`channelsNormalPoll`, `channelsSafetyPoll`, skipped healthy)

Admin API: `GET /api/admin/observability/status` includes a `websub` section.

## Normal Operations (flag OFF)

1. GitHub Actions runs on schedule.
2. Each job exits immediately with `status: "skipped"` when `WEBSUB_ENABLED=false`.
3. Callback API returns **410 Gone** when disabled.
4. Watchlist Discovery continues normal poll (unchanged).

## Canary Rollout (Step 6B — not started)

Staged expansion using `WEBSUB_CANARY_MAX_CHANNELS`:

1. **10 channels** — set `WEBSUB_CANARY_MAX_CHANNELS=10`, `WEBSUB_ENABLED=true`
2. **30 channels** — increase limit to `30`
3. **100 channels** — increase limit to `100`
4. **Full watchlist** — set `WEBSUB_CANARY_MAX_CHANNELS=0`

Configure secrets in GitHub Actions and Vercel before enabling.

## Feature Flag Rollback

Immediate rollback (no deploy required if env-only):

1. Set `WEBSUB_ENABLED=false` in Vercel + GitHub Actions secrets.
2. Redeploy Vercel (or wait for env propagation).
3. Verify:
   - `npm run websub:status` → `environment.enabled: false`
   - `GET /api/websub/callback` → 410
4. Crons become no-ops; Watchlist poll fallback resumes automatically for all channels.

## Incident Response

### Notification backlog growing

1. Check `websub:status` → `notifications.backlogPending`
2. Check Quota Manager deferred queue (`emergency_discovery`)
3. Worker runs every 15min; pending rows are preserved on quota defer
4. Watchlist normal poll covers degraded/unhealthy subscriptions

### Subscription health degraded

1. Check `subscriptions.byHealth` in status output
2. `websub-reconcile` (daily 04:00 UTC) re-subscribes renew_failed / stale pending_verify
3. `websub-renew-urgent` handles leases expiring within 72h

### Callback failures

1. Confirm `WEBSUB_APP_DOMAIN` matches Vercel deployment
2. Confirm Hub can reach `https://{domain}/api/websub/callback`
3. Check `WEBSUB_HUB_SECRET` matches Hub subscription

### Lease expiry

1. Urgent renew runs every 6h for leases within 72h
2. Reconcile daily repairs orphaned / expired states
3. Unhealthy subscriptions fall back to Watchlist poll

## Manual Job Trigger

GitHub Actions → **Creator Radar WebSub Cron** → **Run workflow** → select job.

Local:

```bash
WEBSUB_ENABLED=true npm run cron:websub-subscribe-new
```

## Pre-Canary Checklist

- [ ] Migration 016 applied to production DB
- [ ] `WEBSUB_HUB_SECRET` set (Vercel + GHA)
- [ ] `WEBSUB_APP_DOMAIN` set to production domain
- [ ] Callback GET returns challenge for test subscription
- [ ] `npm run websub:status` succeeds
- [ ] `WEBSUB_ENABLED` remains `false` until Step 6B approval
