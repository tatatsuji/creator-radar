import { SERVICE_TAGLINE } from "@/lib/home/copy";

export function HomeHero() {
  return (
    <section className="space-y-3" aria-labelledby="home-hero-heading">
      <h1
        id="home-hero-heading"
        className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl lg:text-4xl"
      >
        {SERVICE_TAGLINE}
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-violet-200 sm:text-base">
        ランキングは入口。伸びた理由と、自分に活かせるポイントまで分かるサービスです。
      </p>
    </section>
  );
}
