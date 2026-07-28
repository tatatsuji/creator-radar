# Phase1 Verification Schedule

## 運用ステータス

| 項目 | 状態 | 確認日 |
|------|------|--------|
| Phase1 Verification workflow 認識 | ✅ | 2026-07-28 |
| GitHub Secrets 3件 | ✅ 設定済み | 2026-07-28 |
| verify-env 初回成功 | ✅ commit `62cae93` / job `verify-env` / Success | 2026-07-28 |
| 新 GT Recall 測定 | ⏳ scheduled `finalize-recall` 待ち | — |
| 速度検証 (post-6h-cron) | ⏳ scheduled `remeasure-speed` 待ち | — |
| Phase1 完了判定 | **運用検証中** | — |

> verify-env ログで `migration006Applied: true` を確認済み。Node.js 20 deprecated warning は verify-env（Node 22）では job 成功に影響なし。

## 自動実行の登録状況

| ジョブ | 実行基盤 | スケジュール (UTC) | 手動実行 |
|--------|----------|-------------------|----------|
| Discovery (6h) | **GitHub Actions** `observability-cron.yml` | `0 */6 * * *` | workflow_dispatch (`measurement` / `discovery` / `both`) |
| Measurement (hourly) | GitHub Actions `observability-cron.yml` | `15 * * * *` | workflow_dispatch |
| Finalize Recall (新GT) | GitHub Actions `phase1-verification.yml` | `10 8 * * *` | workflow_dispatch |
| Speed remeasure | GitHub Actions `phase1-verification.yml` | `0 18 * * *` | workflow_dispatch |
| Buzz audit | GitHub Actions `phase1-verification.yml` | workflow_dispatch のみ | workflow_dispatch |
| Verify env (初回確認) | GitHub Actions `phase1-verification.yml` | workflow_dispatch のみ | workflow_dispatch（**デフォルト**） ✅ 完了 |

**Vercel Cron:** discovery は無効（measurement + legacy snapshot のみ）。二重実行なし。

**Timezone:** すべて GitHub Actions cron は **UTC**。YouTube quota リセットは **太平洋時間 0:00**（PST 08:00 UTC / PDT 07:00 UTC）。`10 8 * * *` UTC は PST でも PDT でも quota リセット後に実行される。

### scheduled 実行時に起動する job（workflow 条件）

**Phase1 Verification** (`phase1-verification.yml`)

| cron (UTC) | 起動 job | 起動しない job |
|------------|----------|----------------|
| `0 18 * * *` | `remeasure-speed` のみ | verify-env, finalize-recall, buzz-audit, final-report |
| `10 8 * * *` | `finalize-recall` のみ | verify-env, remeasure-speed, buzz-audit, final-report |

**Creator Radar Observability Cron** (`observability-cron.yml`)

| cron (UTC) | 起動 job | 起動しない job |
|------------|----------|----------------|
| `15 * * * *` | `measurement` のみ | discovery |
| `0 */6 * * *` | `discovery` のみ | measurement |

## 次回 scheduled run（基準: 2026-07-28 09:50 UTC / 18:50 JST）

| workflow | job | UTC | JST |
|----------|-----|-----|-----|
| Phase1 Verification | **remeasure-speed** | **2026-07-28 18:00** | **2026-07-29 03:00** |
| Observability Cron | measurement | 2026-07-28 10:15 | 2026-07-28 19:15 |
| Observability Cron | discovery | 2026-07-28 12:00 | 2026-07-28 21:00 |
| Phase1 Verification | **finalize-recall** | **2026-07-29 08:10** | **2026-07-29 17:10** |

## 評価データの分離（コード確認済み）

### finalize-recall → 新 GT のみで Recall 測定

- 新 GT 生成: `buildDiscoveryRecallGroundTruth()` → `recallGroundTruthFetch.ts`（eval 専用パス）
- 出力: `.validation/discovery-recall-ground-truth-new.json`
- Recall 測定: 上記 new GT のみを `measureDiscoveryRecall()` に渡す
- レポート: `groundTruthType: "new_multi_set"`
- 旧 GT 93%: GHA runner は fresh checkout のため `.validation/` に旧ファイルなし → **混在しない**
- `--skip-discovery`: observability-cron と discovery 二重実行を防止

### remeasure-speed → 6h cron 開始後の動画のみ

- フィルタ: `first_discovered_at >= PHASE1_6H_CRON_START_ISO`（`2026-07-27T18:00:00.000Z`）
- `candidate_discoveries` も `discovered_at >= cronStart`
- レポート: `scope: "post_6h_cron_discoveries_only"`
- サンプル不足時: `extendTo72h: true` → 72h 検証継続（完了扱いにしない）

## Secrets (GitHub repository)

| Secret | 用途 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | DB接続 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB読み書き |
| `YOUTUBE_API_KEY` | GT生成・discovery |

## 実行ログ・artifact（失敗時も残る）

1. GitHub → Actions → run 詳細 → 各 job ログ（失敗 step も保持）
2. Artifacts（`if: always()` + `retention-days: 14`）:
   - `phase1-recall-{run_id}` — finalize-recall
   - `phase1-speed-{run_id}` — remeasure-speed
   - `phase1-buzz-{run_id}` — buzz-audit
   - `phase1-final-report-{run_id}` — final-report

## scheduled run 後の確認チェックリスト

### remeasure-speed 実行後（2026-07-28 18:00 UTC 以降）

- [ ] Actions run: commit SHA、`remeasure-speed` job のみ Success
- [ ] artifact `phase1-speed-*` が存在
- [ ] ログ JSON: `scope: "post_6h_cron_discoveries_only"`
- [ ] `cronStartIso: "2026-07-27T18:00:00.000Z"`
- [ ] `sampleCount` を確認（`< 10` なら `verdict: "extend_to_72h"` → 完了扱いにしない）
- [ ] `passCriteria.medianHours12` / `p90Hours48` / `within24h70` / `cronSuccess95`
- [ ] secrets エラーなし、DB 書き込みなし（読み取りのみ）

### finalize-recall 実行後（2026-07-29 08:10 UTC 以降）

- [ ] Actions run: `finalize-recall` job のみ Success
- [ ] artifact `phase1-recall-*` が存在
- [ ] ログ JSON: `groundTruthType: "new_multi_set"`
- [ ] `recall.overallRecallPercent` ≥ 85% か確認
- [ ] `recall.mainstreamBuzzRecall` ≥ 90% か確認
- [ ] `measurementConnection.rate` ≥ 95% か確認
- [ ] `quota.usageRatio24h` ≤ 70% か確認
- [ ] 旧 GT 93% が Recall 判定に使われていない（`oldGtComparison.oldGtRecallPercent: null` on GHA）
- [ ] `--skip-discovery` により discovery 二重実行なし

### 72h 速度検証ウィンドウ終了後（2026-07-30 18:00 UTC 以降）

- [ ] remeasure-speed 再確認: `sufficientSample: true` または 72h 経過後の最終 verdict
- [ ] 発見時間: 中央値 ≤ 12h、P90 ≤ 48h、24h 以内 ≥ 70%
- [ ] cron 成功率 ≥ 95%

### buzz-audit（workflow_dispatch、最終判定前）

- [ ] `scoreZeroCount: 0`
- [ ] `nonPositiveVelocityCount: 0`
- [ ] `measuredRate` ≥ 80%
- [ ] `uniqueChannelCount` ≥ 50

## Node.js 20 deprecated warning

| 判定 | 内容 |
|------|------|
| 今すぐ必須か | **警告のみなら後回し可** |
| 実行失敗リスク | **あり** — verify-env と同じ Supabase WebSocket エラーが Node 20 job（remeasure-speed, finalize-recall 等）で再発する可能性 |
| 最小修正案 | 失敗した job の `node-version` を `"22"` に変更（verify-env と同様）。Phase1 ロジック変更なし |
| 推奨タイミング | **次回 remeasure-speed（本日 18:00 UTC）前** |

## 初回手動確認（push 後）— 完了

1. ✅ **verify-env** — Success（commit `62cae93`）
2. 必要に応じて **`remeasure-speed`** または **`buzz-audit`**（DB 読み取り中心）
3. **`finalize-recall`** / **`full-report`** — quota リセット後の scheduled 実行を推奨

## ローカル手動実行

```bash
npm run db:inspect-schema                         # GHA verify-env と同等（読み取りのみ）
npm run phase1:remasure-speed                     # 6h cron 以降の速度のみ（読み取りのみ）
npm run audit:buzz-top100                         # バズランキング監査
npm run phase1:finalize-recall -- --skip-discovery --skip-missed-analysis  # 新GT + Recall（quota 消費）
npm run phase1:final-report                         # 最終判定 JSON
```

## Phase1 完了条件（変更なし）

- 新 GT overall Recall ≥ 85%
- Mainstream Buzz Recall ≥ 90%
- measurement 接続率 ≥ 95%
- quota 使用率 ≤ 70%
- 発見時間中央値 ≤ 12h、P90 ≤ 48h、24h 以内発見率 ≥ 70%
- cron 成功率 ≥ 95%
- score 0、velocity ≤ 0 の表示なし
- 重大なデータ欠損なし
- サンプル不足時は 72h 検証継続（完了扱いにしない）

## 注意

Cursor セッション内の `sleep` バックグラウンドプロセスは **本番スケジューラではありません**。
Phase1 検証の正式スケジュールは `.github/workflows/phase1-verification.yml` です。
