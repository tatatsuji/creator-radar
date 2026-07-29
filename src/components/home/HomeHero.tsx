import { SERVICE_TAGLINE } from "@/lib/home/copy";
import { formatRankingUpdatedAt } from "@/lib/format";

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
        {SERVICE_TAGLINE}
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-violet-200 sm:text-base">
        バズと伸び始め、2つのランキングから今日のYouTubeを読み解きます。
      </p>
      {dataFreshnessAt ? (
        <p className="text-xs text-zinc-500">
          データ更新: {formatRankingUpdatedAt(dataFreshnessAt)}
        </p>
      ) : null}
    </section>
  );
}
