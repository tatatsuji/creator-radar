# Creator Radar

YouTube 動画の**発見エンジン**と**データ基盤**（Phase1）を構築するプロジェクトです。

## Phase1 スコープ

- 動画候補の発見（watchlist / category / search / mostPopular / live / short-form）
- DB への動画・チャンネル・スナップショット保存
- GitHub Actions による discovery（6h）+ measurement（hourly）
- DB-first 閲覧（ページ表示時に YouTube API を呼ばない）

Phase2 以降（ランキング UX 拡張、AI 分析）は Phase1 完了後。

## ドキュメント

- [Phase1 完了条件](docs/phase1-completion-criteria.md)
- [Phase1 検証スケジュール](docs/phase1-verification-schedule.md)
- [Discovery Recall](docs/discovery-recall.md)

## セットアップ

```bash
cp .env.example .env.local
# .env.local に Supabase / YouTube / CRON_SECRET を設定

npm install
npm run dev
```

## 主要コマンド

```bash
npm run lint
npm run typecheck
npm test
npm run build

npm run cron:discovery      # ローカル discovery（quota 消費）
npm run cron:measurement    # ローカル measurement
npm run db:inspect-schema   # DB schema 確認（読み取りのみ）
npm run verify:pipeline     # Phase1 パイプライン検証
```

## Cron（本番）

| ジョブ | 基盤 | スケジュール (UTC) |
|--------|------|-------------------|
| Discovery | GitHub Actions | `0 */6 * * *` |
| Measurement | GitHub Actions | `15 * * * *` |
| Phase1 検証 | GitHub Actions | `phase1-verification.yml` |

Vercel cron は無効（GHA に集約）。

## Deploy

Vercel に deploy。環境変数は `.env.example` 参照。
