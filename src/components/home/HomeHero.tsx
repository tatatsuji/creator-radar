import { formatRankingUpdatedAt } from "@/lib/format";

const HOME_HERO_HEADLINE = "YouTubeの「今」と「次」がわかる。";
const HOME_HERO_SUBCOPY =
  "バズ動画も、伸び始めも。毎日変わるYouTubeの流れを、ひと目でチェックできます。";

interface HomeHeroProps {
  dataFreshnessAt?: string | null;
}

export function HomeHero({ dataFreshnessAt = null }: HomeHeroProps) {
  return (
    <section className="space-y-3" aria-labelledby="home-hero-heading">
      <h1
        id="home-hero-heading"
        className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl lg:text-4xl"
      >
        {HOME_HERO_HEADLINE}
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-violet-200 sm:text-base">
        {HOME_HERO_SUBCOPY}
      </p>
      {dataFreshnessAt ? (
        <p className="text-xs text-zinc-500">
          データ更新: {formatRankingUpdatedAt(dataFreshnessAt)}
        </p>
      ) : null}
    </section>
  );
}
