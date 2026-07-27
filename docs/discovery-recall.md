# Discovery Recall

Phase1 の改善指標は **取得件数ではなく Discovery Recall** です。

## 定義

```
Discovery Recall = 正解100本のうち Creator Radar が発見した本数 / 100
```

## 正解データセット（Ground Truth）

評価専用モジュール `recallGroundTruthFetch.ts` で生成（本番 discovery とはコード経路分離）。

| セット | 目的 | 構成 |
|--------|------|------|
| **Mainstream Buzz** | 日本で広く話題の動画 | mostPopular 総合+カテゴリ、search viewCount |
| **Emerging Creator** | 中小チャンネルの異常成長 | 登録者10万人未満、72h以内、高 velocity |
| **Short Form** | 短尺候補 | videoDuration=short（暫定指標） |
| **Live** | ライブ候補 | eventType=live + completed |

Overall 100本は各セットから buzzScore 上位を統合。

保存: `.validation/discovery-recall-ground-truth.json`

## Short-form candidates

`short_form_candidate` ソース（旧 `shorts_search`）は `search.list` の `videoDuration=short` を使用。

**重要:** これは4分以下の動画を返すだけで、**縦型 YouTube Shorts を正確に判別しません**。API 制約のため暫定指標として分離しています。

## 測定項目

| 項目 | 説明 |
|------|------|
| 発見有無 | `candidate_discoveries` または `videos.first_discovered_at` |
| 発見までの時間 | `first_discovered_at - published_at`（時間） |
| 最初の source | 最も早い `candidate_discoveries.source_type` |

## 実行

```bash
npm run recall:build-ground-truth   # 正解生成（評価専用 API 経路）
npm run recall:measure                # DB 突合
npm run recall:run                    # 一括
npm run recall:analyze-missed         # 未発見原因分析
```

## レポート

`.validation/discovery-recall-report.json`:

- `overallRecall`, `mainstreamBuzzRecall`, `emergingCreatorRecall`, `shortFormRecall`, `liveRecall`
- `latency.medianHours`, `within6h`, `within12h`, `within24h`, `within72h`
- `byFirstSource`, `byCategory`, `sets[]`

## Phase1 合格基準（初期）

| 指標 | 目標 |
|------|------|
| Discovery Recall (overall) | 70%+ |
| Mainstream Buzz Recall | 80%+ |
| 発見時間中央値 | 12h以内 |
| 24h以内発見率 | 70%+ |
| measurement接続率 | 95%+ |
| quota使用率 | 70%以内 |

## 評価リーク防止

`docs/evaluation-leak-prevention.md` を参照。

## カテゴリ戦略

`src/lib/discovery/categoryStrategy.ts` + `OBSERVABILITY_CONFIG.phase1Discovery.categoryStrategy`:

| Tier | カテゴリ | 頻度 |
|------|----------|------|
| A (everyRun) | entertainment, music, game | 6h毎 |
| B (daily) | news | 1日1回 |
| C (rotation) | howto, sports | ローテーション |
| D (searchOnly) | education | search のみ |

mostPopular は **JP 総合50本を毎 run** + Tier A/B/C カテゴリ chart。

## Cron

- **本番:** Vercel Cron `0 */6 * * *`（6時間毎）
- **GitHub Actions:** measurement のみ（discovery は無効化）
