import { genres } from "@/data/genres";
import { buildHomeHref, type HomeUrlState } from "@/lib/home/urlState";
import {
  RANKING_TYPE_LABELS,
  RANKING_TYPE_ONE_LINERS,
} from "@/lib/ranking/rankingMeta";
import { RANKING_TYPES, type RankingType } from "@/types/ranking";

export interface NextReferenceLink {
  id: string;
  label: string;
  description: string;
  href: string;
}

const OTHER_RANKINGS: RankingType[] = RANKING_TYPES.filter(
  (type) => type !== "buzz",
);

export function getVideoNextReferences(
  homeUrlState: HomeUrlState,
): NextReferenceLink[] {
  const links: NextReferenceLink[] = [];
  const currentRanking = homeUrlState.ranking;

  for (const ranking of OTHER_RANKINGS) {
    if (ranking === currentRanking) {
      continue;
    }

    links.push({
      id: `ranking-${ranking}`,
      label: `${RANKING_TYPE_LABELS[ranking]}を見る`,
      description: RANKING_TYPE_ONE_LINERS[ranking],
      href: buildHomeHref({
        ...homeUrlState,
        ranking,
        format: "all",
        genre: "all",
        period: homeUrlState.period,
      }),
    });
  }

  if (homeUrlState.format !== "short") {
    links.push({
      id: "format-short",
      label: "Shortsの伸びを見る",
      description: "短尺で今伸びている動画を確認",
      href: buildHomeHref({
        ...homeUrlState,
        ranking: "buzz",
        format: "short",
        genre: "all",
      }),
    });
  }

  if (homeUrlState.format !== "live") {
    links.push({
      id: "format-live",
      label: "ライブの伸びを見る",
      description: "配信中・急上昇のライブを確認",
      href: buildHomeHref({
        ...homeUrlState,
        ranking: "buzz",
        format: "live",
        genre: "all",
      }),
    });
  }

  if (homeUrlState.genre === "all") {
    links.push({
      id: "genre-game",
      label: "ゲームジャンルの伸びを見る",
      description: "同ジャンル内で伸びている動画を比較",
      href: buildHomeHref({
        ...homeUrlState,
        genre: "game",
        format: "all",
      }),
    });
  } else {
    const genreLabel = genres.find((genre) => genre.id === homeUrlState.genre)?.label;
    links.push({
      id: "genre-all",
      label: "全ジャンルで見る",
      description: `${genreLabel ?? "ジャンル"}フィルターを外して全体を確認`,
      href: buildHomeHref({
        ...homeUrlState,
        genre: "all",
      }),
    });
  }

  links.unshift({
    id: "home-discovery",
    label: "今日の発見に戻る",
    description: "4視点の今日の注目動画をもう一度確認",
    href: buildHomeHref({
      ranking: "buzz",
      period: "24h",
      genre: "all",
      format: "all",
    }),
  });

  return links.slice(0, 6);
}
