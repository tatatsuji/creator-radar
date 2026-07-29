import { genres } from "@/data/genres";
import { buildHomeHref, type HomeUrlState } from "@/lib/home/urlState";
import {
  HOME_UI_RANKING_LABELS,
  HOME_UI_RANKING_ONE_LINERS,
} from "@/lib/ranking/rankingMeta";
import type { HomeUiRankingType } from "@/types/ranking";

export interface NextReferenceLink {
  id: string;
  label: string;
  description: string;
  href: string;
}

const OTHER_RANKING: HomeUiRankingType = "early_rise";

export function getVideoNextReferences(
  homeUrlState: HomeUrlState,
): NextReferenceLink[] {
  const links: NextReferenceLink[] = [];
  const currentRanking = homeUrlState.ranking;
  const otherRanking: HomeUiRankingType =
    currentRanking === "buzz" ? OTHER_RANKING : "buzz";

  links.push({
    id: "home-discovery",
    label: "今日の発見に戻る",
    description: "今日の注目動画をもう一度確認",
    href: buildHomeHref({
      ranking: "buzz",
      period: "24h",
      genre: "all",
      format: "all",
    }),
  });

  links.push({
    id: `ranking-${otherRanking}`,
    label: `${HOME_UI_RANKING_LABELS[otherRanking]}を見る`,
    description: HOME_UI_RANKING_ONE_LINERS[otherRanking],
    href: buildHomeHref({
      ...homeUrlState,
      ranking: otherRanking,
      format: "all",
      genre: "all",
      period: homeUrlState.period,
    }),
  });

  if (homeUrlState.format !== "short") {
    links.push({
      id: "format-short",
      label: "Shortsだけ表示",
      description: "短尺動画に絞り込む",
      href: buildHomeHref({
        ...homeUrlState,
        format: "short",
      }),
    });
  }

  if (homeUrlState.format !== "live") {
    links.push({
      id: "format-live",
      label: "ライブだけ表示",
      description: "ライブ配信に絞り込む",
      href: buildHomeHref({
        ...homeUrlState,
        format: "live",
      }),
    });
  }

  if (homeUrlState.genre === "all") {
    links.push({
      id: "genre-game",
      label: "ゲームジャンルで絞る",
      description: "同ジャンル内の伸びを比較",
      href: buildHomeHref({
        ...homeUrlState,
        genre: "game",
      }),
    });
  } else {
    const genreLabel = genres.find((genre) => genre.id === homeUrlState.genre)?.label;
    links.push({
      id: "genre-all",
      label: "全ジャンル表示",
      description: `${genreLabel ?? "ジャンル"}フィルターを解除`,
      href: buildHomeHref({
        ...homeUrlState,
        genre: "all",
      }),
    });
  }

  return links.slice(0, 5);
}
