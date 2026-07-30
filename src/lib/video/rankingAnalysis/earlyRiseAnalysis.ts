import { getActionableTakeaways } from "@/lib/video/actionableInsights";

import { buildAnalysisFacts } from "./facts";
import type {
  AnalysisHypothesis,
  AnalysisReferencePoint,
  EarlyRiseRankingAnalysis,
  VideoAnalysisInput,
} from "./types";

function buildSummary(input: VideoAnalysisInput): string {
  const { video } = input;
  const isMeasured = video.metrics.metricsSource === "measured";

  if (video.rankingDisplay?.rankReason) {
    return video.rankingDisplay.rankReason;
  }

  if (isMeasured && video.metrics.viewDelta > 0) {
    return "実測データ上、再生速度が上がり始めています。";
  }

  return "推定スコアから、伸び始めの候補として注目されています。";
}

function buildHypotheses(input: VideoAnalysisInput): AnalysisHypothesis[] {
  const { video, promotionMetrics } = input;
  const hypotheses: AnalysisHypothesis[] = [];

  if (video.metrics.viewDelta > 0) {
    hypotheses.push({
      text: `${video.metrics.period}の再生増加が続いており、おすすめに載りやすい状態にある可能性があります。`,
    });
  }

  if (promotionMetrics?.acceleration != null && promotionMetrics.acceleration > 0.1) {
    hypotheses.push({
      text: "再生速度が前の時間帯より速くなっており、伸びが加速している可能性があります。",
    });
  }

  if (video.metrics.viewsPerSubscriber >= 0.5) {
    hypotheses.push({
      text: "登録者数に対して再生が多く、既存ファン以外にも届き始めている可能性があります。",
    });
  }

  if (/\d/.test(video.title) || /[【】]/.test(video.title)) {
    hypotheses.push({
      text: "タイトルで数字や括弧を使い、クリックしやすい構成になっている可能性があります。",
    });
  }

  if (video.contentKind === "short") {
    hypotheses.push({
      text: "Shorts形式のため、短時間で結論が伝わり、最初の数秒で止まってもらいやすい可能性があります。",
    });
  }

  if (hypotheses.length === 0) {
    hypotheses.push({
      text: "公開から時間が経過し、視聴データが蓄積されるにつれて伸び方が見えてくる可能性があります。",
    });
  }

  return hypotheses.slice(0, 4);
}

function buildReferencePoints(input: VideoAnalysisInput): AnalysisReferencePoint[] {
  const takeaways = getActionableTakeaways(input.video);

  const fromTakeaways = takeaways.map((item) => ({
    text: `${item.label}: ${item.tip}`,
  }));

  const extras: AnalysisReferencePoint[] = [];

  if (input.promotionMetrics?.v1h != null) {
    extras.push({
      text: `直近1時間のペース（約${Math.round(input.promotionMetrics.v1h).toLocaleString("ja-JP")}回/時）を、自分の動画の初速と比較してみてください。`,
    });
  }

  return [...fromTakeaways, ...extras].slice(0, 5);
}

export function buildEarlyRiseRankingAnalysis(
  input: VideoAnalysisInput,
): EarlyRiseRankingAnalysis {
  return {
    kind: "early_rise",
    summary: buildSummary(input),
    facts: buildAnalysisFacts(input),
    hypotheses: buildHypotheses(input),
    referencePoints: buildReferencePoints(input),
    disclaimer:
      "「考えられる理由」はデータからの推測です。伸びの要因は複数考えられ、確定ではありません。",
    provider: "rule_based",
  };
}
