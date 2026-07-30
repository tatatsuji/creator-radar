import { buildAnalysisFacts } from "./facts";
import type {
  AnalysisHypothesis,
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
    return "実測データ上、再生が加速し始めています。";
  }

  return "推定スコアから、これから伸びやすい候補として注目されています。";
}

function buildHypotheses(input: VideoAnalysisInput): AnalysisHypothesis[] {
  const { video, promotionMetrics } = input;
  const hypotheses: AnalysisHypothesis[] = [];

  if (promotionMetrics?.acceleration != null && promotionMetrics.acceleration > 0.1) {
    hypotheses.push({
      text: "再生速度が前より速くなっており、伸びが加速している可能性があります。",
    });
  }

  if (video.metrics.viewsPerSubscriber >= 0.5) {
    hypotheses.push({
      text: "登録者数を超える再生があり、新規視聴者にも届き始めている可能性があります。",
    });
  }

  if (/\d/.test(video.title) || /[【】]/.test(video.title)) {
    hypotheses.push({
      text: "タイトルが具体的で、クリックされやすい構成になっている可能性があります。",
    });
  }

  if (hypotheses.length === 0) {
    hypotheses.push({
      text: "計測データが増えるほど、伸びの理由がよりはっきり見えてくる可能性があります。",
    });
  }

  return hypotheses.slice(0, 3);
}

/** 画面に出す事実は主要4項目に絞る */
const HIGHLIGHT_FACT_IDS = [
  "view_delta",
  "velocity",
  "views_per_sub",
  "duration",
  "published",
  "title",
] as const;

export function buildEarlyRiseRankingAnalysis(
  input: VideoAnalysisInput,
): EarlyRiseRankingAnalysis {
  const allFacts = buildAnalysisFacts(input);
  const highlights = HIGHLIGHT_FACT_IDS.flatMap((id) => {
    const fact = allFacts.find((item) => item.id === id);
    return fact ? [fact] : [];
  }).slice(0, 4);

  return {
    kind: "early_rise",
    summary: buildSummary(input),
    facts: highlights.length > 0 ? highlights : allFacts.slice(0, 4),
    hypotheses: buildHypotheses(input),
    disclaimer:
      "「考えられる理由」は推測です。伸びの要因は1つとは限りません。",
    provider: "rule_based",
  };
}
