import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  RANKING_TYPE_DESCRIPTIONS,
  RANKING_TYPE_LABELS,
  RANKING_VIEW_DEFINITIONS,
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
              <li>5つのランキング（バズ・伸び始め・初速・伸びそう・登録者比）と、ジャンル / Shorts / ライブの視点で伸びを比較できます</li>
              <li>動画詳細で「なぜ伸びたか」「真似できるポイント」「次に参考にすべきもの」を確認できます</li>
            </ul>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">8つの視点</h2>
            <ul className="space-y-3">
              {RANKING_VIEW_DEFINITIONS.map((view) => (
                <li
                  key={view.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <p className="font-semibold text-zinc-200">{view.label}</p>
                  <p className="mt-1 text-xs text-violet-200/90">{view.oneLiner}</p>
                  <p className="mt-2 text-zinc-400">{view.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">使い方</h2>
            <ol className="list-decimal space-y-2 pl-5 text-zinc-400">
              <li>ホームで「今日の発見」を確認し、気になる動画をタップします</li>
              <li>5つのランキングタブや8つの視点から、目的に合った一覧を選びます</li>
              <li>動画詳細で伸びの理由・真似ポイント・次に見るべきランキングを確認します</li>
            </ol>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">4つのランキング</h2>
            <ul className="space-y-2">
              {(Object.keys(RANKING_TYPE_LABELS) as Array<keyof typeof RANKING_TYPE_LABELS>).map(
                (type) => (
                  <li key={type} className="text-zinc-400">
                    <span className="font-medium text-zinc-300">
                      {RANKING_TYPE_LABELS[type]}
                    </span>
                    — {RANKING_TYPE_DESCRIPTIONS[type]}
                  </li>
                ),
              )}
            </ul>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
