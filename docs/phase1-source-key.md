# Phase 1: source_key conventions

`candidate_discoveries.source_key` is a stable deduplication key.
Raw search queries and personal data must not be stored as-is.

| source_type | source_key format | builder |
|---|---|---|
| `seed_channel` | `{channel_id}` | `buildSeedSourceKey` |
| `watchlist_upload` | `{channel_id}` | `buildWatchlistUploadSourceKey` |
| `search` | `q:{sha256_prefix}` | `buildSearchSourceKey` |
| `category_search` | `{category_id}:q:{sha256_prefix}` | `buildCategorySearchSourceKey` |
| `most_popular` | `{REGION}:{all\|category_id}` | `buildMostPopularSourceKey` |
| `manual` | `manual:{operator_key}` | `buildManualSourceKey` |
| `related` | `origin:{video_id}` or `theme:q:{sha256_prefix}` | `buildRelatedSourceKey` |

Rules:

- Same normalized input always produces the same `source_key`.
- Search text is normalized (trim, collapse whitespace, lowercase) before hashing.
- Empty, invalid, or overly long inputs are rejected.
- `source_key` length is capped at 200 characters.
