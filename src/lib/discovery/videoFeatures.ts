export interface VideoContentFeatures {
  titleLength: number;
  descriptionLength: number;
  hasNumberInTitle: boolean;
  isQuestionTitle: boolean;
  hasEmotionWords: boolean;
  durationSeconds: number;
  publishedWeekday: number;
  publishedHourJst: number;
  tagCount: number;
}

const EMOTION_WORDS = [
  "感動",
  "衝撃",
  "爆笑",
  "悲報",
  "速報",
  "神",
  "最強",
  "やば",
  "ヤバ",
  "驚",
  "泣",
  "笑",
  "炎上",
  "優勝",
];

export function computeVideoContentFeatures(input: {
  title: string;
  description?: string;
  publishedAt: string;
  durationSeconds: number;
  tags?: string[];
}): VideoContentFeatures {
  const title = input.title.trim();
  const description = input.description?.trim() ?? "";
  const published = new Date(input.publishedAt);
  const jstHour = (published.getUTCHours() + 9) % 24;

  return {
    titleLength: title.length,
    descriptionLength: description.length,
    hasNumberInTitle: /\d/.test(title),
    isQuestionTitle: /[?？]$/.test(title) || /(なぜ|どう|何|誰)/.test(title),
    hasEmotionWords: EMOTION_WORDS.some((word) => title.includes(word)),
    durationSeconds: input.durationSeconds,
    publishedWeekday: published.getUTCDay(),
    publishedHourJst: jstHour,
    tagCount: input.tags?.length ?? 0,
  };
}
