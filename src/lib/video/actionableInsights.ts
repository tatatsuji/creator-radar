import { formatDurationSeconds } from "@/lib/format";
import type { Video } from "@/types";

export type ActionableCategory = "title" | "timing" | "format" | "reach";

export interface ActionableTakeaway {
  category: ActionableCategory;
  label: string;
  observation: string;
  tip: string;
}

const EMOTIONAL_WORDS = [
  "衝撃",
  "やばい",
  "神",
  "最強",
  "驚き",
  "感動",
  "暴露",
  "秘密",
  "裏技",
  "初心者",
  "必見",
  "朗報",
  "悲報",
  "正直",
  "ガチ",
  "本気",
  "徹底",
  "完全",
  "まとめ",
  "解説",
] as const;

const CATEGORY_LABELS: Record<ActionableCategory, string> = {
  title: "タイトル",
  timing: "投稿タイミング",
  format: "動画フォーマット",
  reach: "届き方",
};

export function getActionableCategoryLabel(category: ActionableCategory): string {
  return CATEGORY_LABELS[category];
}

function analyzeTitle(title: string): ActionableTakeaway | null {
  const trimmed = title.trim();
  if (!trimmed) {
    return null;
  }

  const charCount = [...trimmed].length;
  const hasNumber = /\d/.test(trimmed);
  const hasBracket = /[【】\[\]()]/.test(trimmed);
  const hasQuestion = /[？?]/.test(trimmed);
  const emotionalHits = EMOTIONAL_WORDS.filter((word) => trimmed.includes(word));

  const traits: string[] = [`${charCount}文字`];
  if (hasNumber) traits.push("数字あり");
  if (hasBracket) traits.push("括弧で強調");
  if (hasQuestion) traits.push("疑問形");
  if (emotionalHits.length > 0) traits.push(`感情ワード（${emotionalHits.slice(0, 2).join("・")}）`);

  let tip =
    "短く具体的なタイトルで、視聴者が得られることを先に書く構成が参考になります。";

  if (hasNumber && hasBracket) {
    tip =
      "数字＋括弧で結論を先に見せる構成。自分の動画でも「結果＋理由」をタイトル前半に置くと参考になります。";
  } else if (hasQuestion) {
    tip =
      "疑問形で好奇心を刺激する構成。自分の企画でも「視聴者が知りたい問い」をタイトルに入れてみてください。";
  } else if (emotionalHits.length > 0) {
    tip =
      "感情ワードでクリックを促す構成。自分のジャンルに合う感情語（驚き・解説・暴露など）を1語入れるのが真似ポイントです。";
  } else if (charCount <= 28) {
    tip =
      "短めタイトルでサムネとセットで意味が伝わる構成。スマホ表示を意識した文字数が参考になります。";
  }

  return {
    category: "title",
    label: CATEGORY_LABELS.title,
    observation: traits.join(" · "),
    tip,
  };
}

function getJstDate(iso: string): Date {
  const utc = new Date(iso);
  return new Date(utc.getTime() + 9 * 60 * 60 * 1000);
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function analyzeTiming(publishedAt: string): ActionableTakeaway {
  const jst = getJstDate(publishedAt);
  const weekday = WEEKDAY_LABELS[jst.getUTCDay()] ?? "日";
  const hour = jst.getUTCHours();
  const timeLabel = `${String(hour).padStart(2, "0")}:00`;

  let dayPart: string;
  if (hour >= 5 && hour < 11) {
    dayPart = "朝";
  } else if (hour >= 11 && hour < 17) {
    dayPart = "昼";
  } else if (hour >= 17 && hour < 22) {
    dayPart = "夜";
  } else {
    dayPart = "深夜";
  }

  const isWeekend = jst.getUTCDay() === 0 || jst.getUTCDay() === 6;

  let tip =
    "投稿時間帯はジャンルによって最適解が異なります。同ジャンルの伸びている動画の公開時間を横並びで確認するのが近道です。";

  if (isWeekend && hour >= 18 && hour <= 23) {
    tip =
      "週末夜の投稿。エンタメ・ゲーム系では視聴時間が取りやすい帯です。自分も週末夜の同帯投稿を試す価値があります。";
  } else if (!isWeekend && hour >= 18 && hour <= 22) {
    tip =
      "平日夜の投稿。通勤・就寝前の視聴ピークに合わせたタイミング。自分の視聴者層が活動する時間帯と照合してみてください。";
  } else if (hour >= 11 && hour <= 14) {
    tip =
      "昼帯の投稿。Shortsやライト視聴向けジャンルでは昼休み需要を狙える可能性があります。";
  }

  return {
    category: "timing",
    label: CATEGORY_LABELS.timing,
    observation: `${weekday}曜 ${dayPart} ${timeLabel}（JST）`,
    tip,
  };
}

function analyzeFormat(video: Video): ActionableTakeaway | null {
  const duration = video.durationSeconds;
  const kind = video.contentKind;

  if (kind === "short") {
    return {
      category: "format",
      label: CATEGORY_LABELS.format,
      observation: `Shorts · ${duration ? formatDurationSeconds(duration) : "短尺"}`,
      tip:
        "Shorts形式。縦型・短尺・冒頭1秒のフックが勝負。自分も15〜60秒で結論先出しの構成を試せます。",
    };
  }

  if (kind === "live") {
    return {
      category: "format",
      label: CATEGORY_LABELS.format,
      observation: `ライブ配信${duration ? ` · ${formatDurationSeconds(duration)}` : ""}`,
      tip:
        "ライブ形式。リアルタイム性と長尺が強み。アーカイブ切り出しやハイライト化も真似ポイントになります。",
    };
  }

  if (duration == null) {
    return null;
  }

  let bucket: string;
  let tip: string;

  if (duration <= 180) {
    bucket = "3分以内（短尺）";
    tip =
      "短尺動画。結論までの距離が短く、完走率を取りやすい長さ。自分も「1テーマ1結論」の短尺企画が参考になります。";
  } else if (duration <= 600) {
    bucket = "3〜10分（中尺）";
    tip =
      "中尺動画。情報量と完走率のバランス型。自分のジャンルでも8〜10分前後の構成を試す価値があります。";
  } else if (duration <= 1200) {
    bucket = "10〜20分";
    tip =
      "やや長尺。深掘り・解説系で伸びやすい長さ。章立てとテンポで離脱を防ぐ構成が真似ポイントです。";
  } else {
    bucket = "20分超（長尺）";
    tip =
      "長尺動画。滞在時間とエンゲージメントが鍵。チャプター分けと定期的な画面変化が参考になります。";
  }

  return {
    category: "format",
    label: CATEGORY_LABELS.format,
    observation: bucket,
    tip,
  };
}

function analyzeReach(video: Video): ActionableTakeaway | null {
  if (video.channel.subscriberCountHidden) {
    return null;
  }

  const ratio = video.metrics.viewsPerSubscriber;
  const subs = video.channel.subscriberCount;

  if (ratio >= 1) {
    return {
      category: "reach",
      label: CATEGORY_LABELS.reach,
      observation: `登録者${subs.toLocaleString("ja-JP")}人に対し、再生が登録者数を上回る届き方`,
      tip:
        "登録者を超える再生＝アルゴリムに拾われたまたは外部流入あり。タイトル・サムネ・初速の組み合わせが自分の参考になります。",
    };
  }

  if (ratio >= 0.3) {
    return {
      category: "reach",
      label: CATEGORY_LABELS.reach,
      observation: `登録者比 ${(ratio * 100).toFixed(0)}% — チャンネル規模に対して届いている`,
      tip:
        "既存ファンに加え、新規視聴者にも届いている可能性。タイトルの検索・おすすめ向きキーワードを分析してみてください。",
    };
  }

  return null;
}

/**
 * Rule-based "imitate this" takeaways from existing video metadata.
 * Phase3 AI analysis preview — no scoring or discovery changes.
 */
export function getActionableTakeaways(video: Video): ActionableTakeaway[] {
  return [
    analyzeTitle(video.title),
    analyzeTiming(video.publishedAt),
    analyzeFormat(video),
    analyzeReach(video),
  ].filter((item): item is ActionableTakeaway => item != null);
}
