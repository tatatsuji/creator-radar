# Phase1 Verification Schedule

## 自動実行の登録状況

| ジョブ | 実行基盤 | スケジュール (UTC) | 手動実行 |
|--------|----------|-------------------|----------|
| Discovery (6h) | **GitHub Actions** `observability-cron.yml` | `0 */6 * * *` | workflow_dispatch (`measurement` / `discovery` / `both`) |
| Measurement (hourly) | GitHub Actions `observability-cron.yml` | `15 * * * *` | workflow_dispatch |
| Finalize Recall (新GT) | GitHub Actions `phase1-verification.yml` | `10 8 * * *` | workflow_dispatch |
| Speed remeasure | GitHub Actions `phase1-verification.yml` | `0 18 * * *` | workflow_dispatch |
| Buzz audit | GitHub Actions `phase1-verification.yml` | workflow_dispatch のみ | workflow_dispatch |
| Verify env (初回確認) | GitHub Actions `phase1-verification.yml` | workflow_dispatch のみ | workflow_dispatch（**デフォルト**） |

**Vercel Cron:** discovery は無効（measurement + legacy snapshot のみ）。二重実行なし。

**Timezone:** すべて GitHub Actions cron は **UTC**。YouTube quota リセットは **太平洋時間 0:00**（PST 08:00 UTC / PDT 07:00 UTC）。`10 8 * * *` UTC は PST でも PDT でも quota リセット後に実行される。

## Secrets (GitHub repository)

| Secret | 用途 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | DB接続 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB読み書き |
| `YOUTUBE_API_KEY` | GT生成・discovery |

## 実行ログの確認

1. GitHub → Actions → **Phase1 Verification** または **Creator Radar Observability Cron**
2. Run 詳細 → 各 job のログ
3. Artifacts: `phase1-recall-*`, `phase1-speed-*`, `phase1-buzz-*`, `phase1-final-report-*`

## 初回手動確認（push 後）

1. **Phase1 Verification** → **Run workflow** → job: **`verify-env`**（DB schema 読み取りのみ、YouTube API 不使用）
2. 成功後、必要に応じて **`remeasure-speed`** または **`buzz-audit`**（DB 読み取り中心）
3. **`finalize-recall`** / **`full-report`** は quota を消費するため、quota リセット後のスケジュール実行を推奨

## ローカル手動実行

```bash
npm run db:inspect-schema                         # GHA verify-env と同等（読み取りのみ）
npm run phase1:remasure-speed                     # 6h cron 以降の速度のみ（読み取りのみ）
npm run audit:buzz-top100                         # バズランキング監査
npm run phase1:finalize-recall -- --skip-discovery --skip-missed-analysis  # 新GT + Recall（quota 消費）
npm run phase1:final-report                         # 最終判定 JSON
```

## 注意

Cursor セッション内の `sleep` バックグラウンドプロセスは **本番スケジューラではありません**。
Phase1 検証の正式スケジュールは `.github/workflows/phase1-verification.yml` です。
