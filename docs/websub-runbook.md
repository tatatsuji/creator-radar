# WebSub Operations Runbook (Phase 2 Step 6A + 6B)

Operations foundation is deployed with **`WEBSUB_ENABLED=false` by default**.
Crons and GitHub Actions are wired. **Step 6B canary code is ready** — enable the flag only when you are ready to start rollout.

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
| `WEBSUB_CANARY_MAX_CHANNELS` | `0` | Canary cap (`0` = unlimited) |
| `WEBSUB_HUB_URL` | Google Hub | Hub endpoint |
| `WEBSUB_SAFETY_POLL_INTERVAL_HOURS` | `24` | Safety poll interval |

Vercel production must also set `WEBSUB_*` for the callback API route.

## Canary Channel Selection (Step 6B)

When `WEBSUB_ENABLED=true`, **subscribe-new only** applies the canary cap:

1. Eligible watchlist: non-archive, status in `seed` / `discovered` / `active`
2. Priority: **hot → active → normal → cold → channel_id ascending**
3. Take first **N** channels (`N = WEBSUB_CANARY_MAX_CHANNELS`)
4. `N = 0` → no cap (full eligible watchlist)

**Not capped:** renew-urgent, renew-daily, reconcile, notification worker, watchlist poll.

**Cap shrink:** existing subscriptions are **not** auto-unsubscribed. Renew continues for live rows. To stop WebSub entirely, set `WEBSUB_ENABLED=false`.

## Observability

```bash
npm run websub:status
```

Key fields:

- `environment.enabled` / `environment.canaryMaxChannels`
- `canary.eligibleCount` / `canary.selectedCount` / `canary.selectedByTier`
- `canary.liveSubscriptionCount` vs `canary.selectedCount`
- `subscriptions.byHealth` — target ≥ 90% healthy at full rollout
- `notifications.backlogPending` — should stay low
- `watchlistPollFallback` — canary外 channels stay on normal poll

Admin API: `GET /api/admin/observability/status` includes a `websub` section.

## Normal Operations (flag OFF)

1. GitHub Actions runs on schedule.
2. Each job exits immediately with `status: "skipped"` when `WEBSUB_ENABLED=false`.
3. Callback API returns **410 Gone** when disabled.
4. Watchlist Discovery continues normal poll (unchanged).

## Canary Rollout Procedure

### Phase 0 — Pre-flight (flag still OFF)

- [ ] Migration 016 applied
- [ ] `WEBSUB_HUB_SECRET` set (Vercel + GHA, same value)
- [ ] `WEBSUB_APP_DOMAIN` = production domain
- [ ] Step 6B code deployed (`canary` section visible in `websub:status`)
- [ ] `npm run websub:status` succeeds

### Phase 1 — 10 channels

1. Set **Vercel Production** + **GHA secrets**:
   - `WEBSUB_ENABLED=true`
   - `WEBSUB_CANARY_MAX_CHANNELS=10`
2. Redeploy Vercel (env propagation).
3. GHA manual run: **websub-subscribe-new**
   - Expect: `canary.selectedCount` ≤ 10, `attempted` ≤ 10
4. Wait for Hub GET verification → `websub_subscriptions.status = active`
5. Monitor 24–48h:
   - `npm run websub:status`
   - Watchlist / Measurement / Ranking unchanged for non-canary channels
   - `notifications.backlogPending` stable

### Phase 2 — 30 channels

1. Update `WEBSUB_CANARY_MAX_CHANNELS=30` (Vercel + GHA)
2. Redeploy Vercel
3. Manual **websub-subscribe-new** (adds up to 20 new channels)
4. Monitor 24–48h (same checks)

### Phase 3 — 100 channels

1. Update `WEBSUB_CANARY_MAX_CHANNELS=100`
2. Manual **websub-subscribe-new**
3. Monitor 24–48h

### Phase 4 — Full watchlist

1. Set `WEBSUB_CANARY_MAX_CHANNELS=0` (unlimited)
2. Manual **websub-subscribe-new**
3. Monitor until `subscription_health = healthy` rate ≥ 90%

## Feature Flag Rollback

Immediate rollback (env-only):

1. Set `WEBSUB_ENABLED=false` in Vercel + GitHub Actions secrets.
2. Redeploy Vercel (or wait for env propagation).
3. Verify:
   - `npm run websub:status` → `environment.enabled: false`
   - `GET /api/websub/callback` → 410
4. Crons become no-ops; Watchlist poll fallback resumes for all channels.

Existing `websub_subscriptions` rows remain in DB but receive no new Hub traffic while disabled.

## Incident Response

### Notification backlog growing

1. Check `websub:status` → `notifications.backlogPending`
2. Check Quota Manager deferred queue (`emergency_discovery`)
3. Worker runs every 15min; pending rows preserved on quota defer
4. Watchlist normal poll covers degraded/unhealthy subscriptions

### Subscription health degraded

1. Check `subscriptions.byHealth` in status output
2. `websub-reconcile` (daily 04:00 UTC) re-subscribes renew_failed / stale pending_verify
3. `websub-renew-urgent` handles leases expiring within 72h

### Callback failures

1. Confirm `WEBSUB_APP_DOMAIN` matches Vercel deployment
2. Confirm Hub can reach `https://{domain}/api/websub/callback`
3. Check `WEBSUB_HUB_SECRET` matches between Vercel and GHA

### Canary channel not subscribing

1. Check `canary.selectedByTier` — hot channels selected first
2. Confirm channel is in eligible watchlist (not archive)
3. Run subscribe-new manually and inspect JSON `canary` block

## Manual Job Trigger

GitHub Actions → **Creator Radar WebSub Cron** → **Run workflow** → select job.

Recommended order when enabling:

1. `websub-subscribe-new`
2. Wait for Hub verification (check DB or status)
3. `websub-process-notifications`
4. Confirm watchlist-discovery still processes non-canary channels

Local:

```bash
WEBSUB_ENABLED=true WEBSUB_CANARY_MAX_CHANNELS=10 npm run cron:websub-subscribe-new
```

## Success Criteria (Step 6B)

| Check | Target |
|-------|--------|
| subscribe-new respects cap | `attempted` ≤ `WEBSUB_CANARY_MAX_CHANNELS` |
| Hub verification | `active` + `last_verified_at` set |
| Non-canary watchlist | `channelsNormalPoll` unchanged vs baseline |
| Healthy rate (full rollout) | ≥ 90% |
| Notification backlog | Stable, no unbounded growth |
| Discovery / Measurement / Ranking | No regressions |
