import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  CONTENT_FILTER_DEFINITIONS,
  RANKING_TYPE_DESCRIPTIONS,
  RANKING_TYPE_LABELS,
  SERVICE_TAGLINE,
} from "@/lib/home/copy";

export const metadata = {
  title: "Creator Radarについて",
  description: "Creator Radarの目的と使い方",
};

export default function AboutPage() {
  return (
    <div className="app-background flex min-h-screen flex-col">
      <SiteHeader variant="default" backHref="/" backLabel="ホーム" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <article className="glass-panel space-y-6 p-6 sm:p-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-zinc-50">Creator Radarについて</h1>
            <p className="text-sm text-zinc-400">{SERVICE_TAGLINE}</p>
          </header>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">できること</h2>
            <ul className="list-disc space-y-2 pl-5 text-zinc-400">
              <li>ホームの「今日の発見」で、いま注目の動画を数分で把握できます</li>
              <li>バズ / 伸び始めの2つのランキングで、目的に合った伸びを見つけられます</li>
              <li>ジャンル・Shorts・ライブはフィルターとして、同じランキングを絞り込めます</li>
              <li>動画詳細で「なぜ伸びたか」「真似できるポイント」「次に参考にすべきもの」を確認できます</li>
            </ul>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">2つのランキング</h2>
            <ul className="space-y-3">
              {(Object.keys(RANKING_TYPE_LABELS) as Array<keyof typeof RANKING_TYPE_LABELS>).map(
                (type) => (
                  <li
                    key={type}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <p className="font-semibold text-zinc-200">
                      {RANKING_TYPE_LABELS[type]}
                    </p>
                    <p className="mt-2 text-zinc-400">{RANKING_TYPE_DESCRIPTIONS[type]}</p>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">表示フィルター</h2>
            <ul className="space-y-3">
              {CONTENT_FILTER_DEFINITIONS.map((filter) => (
                <li
                  key={filter.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <p className="font-semibold text-zinc-200">{filter.label}</p>
                  <p className="mt-1 text-xs text-violet-200/90">{filter.oneLiner}</p>
                  <p className="mt-2 text-zinc-400">{filter.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">使い方</h2>
            <ol className="list-decimal space-y-2 pl-5 text-zinc-400">
              <li>ホームで「今日の発見」を確認し、気になる動画をタップします</li>
              <li>バズ / 伸び始めを選び、必要ならジャンル・形式で絞り込みます</li>
              <li>動画詳細で伸びの理由・真似ポイント・次の参考先を確認します</li>
            </ol>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
