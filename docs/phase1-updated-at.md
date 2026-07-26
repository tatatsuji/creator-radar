# Phase 1: updated_at policy

Phase 1 does **not** add PostgreSQL triggers for `updated_at`.

Tables with `updated_at`:

- `channel_watchlist`
- `measurement_schedule`

Repository implementations (Phase 1 follow-up) must set `updated_at`
explicitly on every insert and update, matching the existing pattern in
`src/lib/snapshots/repository.ts` for `channels` and `videos`.

Do not rely on database defaults after the initial insert.
