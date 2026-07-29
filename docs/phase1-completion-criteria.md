# Phase1 完了条件

Phase1 = **動画発見エンジン** + **データ基盤** のみ。Phase2（ランキング UX / AI）以降は対象外。

## 1. 発見ソース（Discovery）

| 要件 | 完了条件 |
|------|----------|
| 人気チャンネル監視 | watchlist 経由で uploads を 6h cron が取得 |
| カテゴリ取得 | tiered category_search が rotation 付きで実行 |
| 新着動画取得 | watchlist uploads + search (24h/7d) |
| ライブ取得 | live_search ソースで候補登録 |
| Shorts / 短尺 | short_form_candidate（API 上 ≤4min）で候補登録 |
| 急上昇候補 | search + most_popular (JP tiered) |
| 重複除去 | `(video_id, source_type, source_key)` unique + fetch merge |
| discovery 二重実行なし | GHA observability-cron が primary、phase1-verification は `--skip-discovery` |

## 2. データ永続化

| 要件 | 完了条件 |
|------|----------|
| 動画情報保存 | videos + channels upsert（migration 006 列含む） |
| スナップショット保存 | measurement → video_snapshots（hourly dedup） |
| 発見 provenance | candidate_discoveries に source 記録 |
| measurement スケジュール | discovery 後 upsertSchedule |

## 3. DB-first

| 要件 | 完了条件 |
|------|----------|
| 閲覧時 YouTube API 不使用 | ランキング・動画詳細・deltas/history は DB のみ |
| Cron のみ YouTube API | discovery / measurement / GT 生成 |

## 4. Cron・安定稼働

| 要件 | 完了条件 |
|------|----------|
| Discovery | GHA `0 */6 * * *` UTC |
| Measurement | GHA `15 * * * *` UTC |
| Vercel cron | legacy snapshot/measurement **無効**（GHA に集約） |
| watchlist 失敗隔離 | candidate engine は watchlist 失敗後も実行 |
| Node.js | GHA 全 job Node 22（Supabase WebSocket 対応） |

## 5. 運用検証（数値ゲート）

| 指標 | 閾値 |
|------|------|
| 新 GT overall Recall | ≥ 85% |
| Mainstream Buzz Recall | ≥ 90% |
| measurement 接続率 | ≥ 95% |
| quota 使用率（24h） | ≤ 70% |
| 発見時間中央値 | ≤ 12h（post-6h-cron サンプル） |
| P90 発見時間 | ≤ 48h |
| 24h 以内発見率 | ≥ 70% |
| cron 成功率 | ≥ 95% |
| buzz 品質 | score 0 / velocity ≤ 0 表示なし |
| データ品質 | migration 006 適用、重大欠損なし |

サンプル不足時は **72h 検証継続**（完了扱いにしない）。

## 判定

- **コード完成**: 上記 1〜4 を満たす
- **Phase1 完成**: 上記 1〜5 をすべて満たす

詳細スケジュール: `docs/phase1-verification-schedule.md`
