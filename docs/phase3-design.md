# Creator Radar Phase3 設計書

## 1. 完成イメージ

Phase3 完了時、動画詳細ページは **ランキングの文脈に最適化された分析画面** になる。

| 流入 | ユーザーの問い | ページが返す価値 |
|------|----------------|------------------|
| バズ動画 | なぜ今話題？何が起きている？ | 3〜5行の平易な説明。専門用語なし。 |
| 伸び始め | なぜ伸びた？何を真似できる？ | 事実→考えられる理由→参考ポイント→今日試せる施策 |

ホームは「今日の入口」。**毎日開く理由は動画詳細**。

---

## 2. 画面構成

```
[Header] サムネ・タイトル・チャンネル・期間タブ
    ↓
[Ranking Analysis] ★ Phase3 コア（ランキング別に出し分け）
    ↓
[Actionable Takeaways] 伸び始めのみ（真似できるポイント）
    ↓
[Growth Metrics] 数値の裏付け
    ↓
[Measured Panel] 実測グラフ
    ↓
[Next References] 次に見るべき動画
```

### バズ動画レイアウト

1. **いまの勢い** — 再生増・速度（1行サマリー）
2. **なぜ今話題なのか** — AI/ルールベース 3〜5行（一般向け）
3. 数値・グラフ（既存コンポーネント）

### 伸び始めレイアウト

1. **分析サマリー** — スコア・ひとこと
2. **① 事実** — タイトル/尺/投稿時間/率/速度/加速度（カード）
3. **② 考えられる理由** — 断定しない推測（箇条書き）
4. **③ 参考になるポイント** — クリエイター向け示唆
5. **真似できるポイント** — 今日試せる具体案（既存を拡張）
6. 数値・グラフ

---

## 3. カード構成

### BuzzAnalysisCard

| カード | 内容 |
|--------|------|
| MomentumSummary | 期間内の再生増・勢いラベル |
| WhyTrendingNow | 3〜5行テキスト。disclaimer 付き |

### EarlyRiseAnalysisCards

| カード | 内容 |
|--------|------|
| FactGrid | 8項目以内。欠損は非表示 |
| PossibleReasons | max 4。語尾「〜の可能性があります」 |
| ReferencePoints | max 4。クリエイター向け |
| ActionableTakeaways | 既存4カテゴリ（title/timing/format/reach） |

---

## 4. AI 分析フロー

```
VideoDetailPage (SSR)
  → buildVideoAnalysisInput(videoId)  … DB から video + snapshots
  → getRankingOptimizedAnalysis(input, ranking, period)
       ├─ cache hit? → return cached
       ├─ OPENAI_API_KEY あり & paid tier? → OpenAI provider
       └─ else → RuleBased provider（Phase3 v1 デフォルト）
  → RankingAnalysis UI
```

**Phase3 v1**: RuleBased を本番デフォルト。OpenAI はインターフェースのみ用意。

---

## 5. OpenAI 利用方針

| 項目 | 方針 |
|------|------|
| モデル | `gpt-4o-mini`（コスト/速度バランス） |
| 入力 | 構造化 facts JSON のみ。生 description 全文は送らない（トークン節約） |
| 出力 | JSON schema 固定（summary / reasons / referencePoints） |
| トーン | バズ=一般向け平易語。伸び始め=推測は断定禁止 |
| フォールバック | API 失敗時 RuleBased に自動切替 |
| 環境変数 | `OPENAI_API_KEY`（任意） |

---

## 6. キャッシュ戦略

| レイヤ | 方式 | TTL |
|--------|------|-----|
| L1 | `unstable_cache`（Next.js）キー: videoId+ranking+period+metricsHash | 6h |
| L2（将来） | Supabase `video_analyses` テーブル | 24h |

metricsHash = viewDelta + viewVelocity + rankingScore の丸め値。  
スナップショット更新で metrics が変われば再生成。

---

## 7. 無料版 / 有料版

| 機能 | 無料 | 有料（将来） |
|------|------|--------------|
| バズ「なぜ話題」 | RuleBased 3行 | OpenAI 5行 + タグ |
| 伸び始め 事実 | ○ | ○ |
| 伸び始め 推測・参考 | RuleBased | OpenAI 深掘り |
| 真似ポイント | 4カテゴリ | + サムネ/編集テンポ（将来） |
| 分析回数 | 無制限（RuleBased） | OpenAI 日次上限 |

Phase3 v1 は **全機能を無料で RuleBased 提供**。OpenAI は feature flag。

---

## 8. 開発ルール（遵守）

- Phase1（discovery / measurement / cron / DB 収集 / スコア）に触れない
- Phase2 ホーム UX を壊さない
- 変更は動画詳細中心

---

## 9. 完了条件チェックリスト

- [ ] バズ: 「なぜ今話題なのか」が 3〜5 行で分かる
- [ ] 伸び始め: 事実→理由→参考→真似ポイントの順
- [ ] 推測は断定しない
- [ ] 動画詳細だけでも開く価値がある
