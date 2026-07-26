import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  BUZZ_VIDEOS_LABEL,
  RANKING_REFERENCE_LABEL,
  RISING_VIDEOS_LABEL,
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
              <li>{BUZZ_VIDEOS_LABEL}と{RISING_VIDEOS_LABEL}を切り替えて確認できます</li>
              <li>{RANKING_REFERENCE_LABEL}と再生速度から、いま伸びている動画を把握できます</li>
              <li>動画分析ページで、主要指標と実測推移を確認できます</li>
            </ul>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">使い方</h2>
            <ol className="list-decimal space-y-2 pl-5 text-zinc-400">
              <li>ホームで{BUZZ_VIDEOS_LABEL}または{RISING_VIDEOS_LABEL}を選びます</li>
              <li>{BUZZ_VIDEOS_LABEL}では期間とジャンルを選び、気になる動画をタップします</li>
              <li>動画分析ページで{RANKING_REFERENCE_LABEL}や実測グラフを確認できます</li>
            </ol>
          </section>

          <section className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="text-base font-semibold text-zinc-100">
              {RANKING_REFERENCE_LABEL}について
            </h2>
            <p className="text-zinc-400">
              再生速度、登録者数に対する伸び、公開からの経過時間などをもとに、0〜100の参考値として表示しています。数値が高いほど、選択した期間内で相対的に伸びている動画です。
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
