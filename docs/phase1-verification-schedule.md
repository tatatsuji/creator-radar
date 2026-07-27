# Phase1 Verification Schedule

## 自動実行の登録状況

| ジョブ | 実行基盤 | スケジュール (UTC) | 手動実行 |
|--------|----------|-------------------|----------|
| Discovery (6h) | **GitHub Actions** `observability-cron.yml` | `0 */6 * * *` | workflow_dispatch |
| Measurement (hourly) | GitHub Actions `observability-cron.yml` | `15 * * * *` | workflow_dispatch |
| Finalize Recall (新GT) | GitHub Actions `phase1-verification.yml` | `10 7 * * *` | workflow_dispatch |
| Speed remeasure | GitHub Actions `phase1-verification.yml` | `0 18 * * *` | workflow_dispatch |
| Buzz audit | GitHub Actions `phase1-verification.yml` | workflow_dispatch のみ | workflow_dispatch |

**Vercel Cron:** discovery は無効（measurement + legacy snapshot のみ）。二重実行なし。

**Timezone:** すべて GitHub Actions cron は **UTC**。YouTube quota リセットは **太平洋時間 0:00**（UTC 07:00 夏時間）。

## Secrets (GitHub repository)

| Secret | 用途 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | DB接続 |
| `SUPABASE_SERVICE_ROLE_KEY` | DB読み書き |
| `YOUTUBE_API_KEY` | GT生成・discovery |

## 実行ログの確認

1. GitHub → Actions → **Phase1 Verification** または **Creator Radar Observability Cron**
2. Run 詳細 → 各 job のログ
3. Artifacts: `phase1-recall-*`, `phase1-speed-*`, `phase1-buzz-*`

## ローカル手動実行

```bash
npm run phase1:finalize-recall -- --skip-discovery   # 新GT + Recall（discovery は GHA に任せる）
npm run phase1:remasure-speed                        # 6h cron 以降の速度のみ
npm run audit:buzz-top100                            # バズランキング監査
npm run phase1:final-report                          # 最終判定 JSON
```

## 注意

Cursor セッション内の `sleep` バックグラウンドプロセスは **本番スケジューラではありません**。
Phase1 検証の正式スケジュールは `.github/workflows/phase1-verification.yml` です。
