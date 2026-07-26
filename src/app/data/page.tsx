import Link from "next/link";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata = {
  title: "データについて",
  description: "Creator Radarで利用しているデータの説明",
};

export default function DataPage() {
  return (
    <div className="app-background flex min-h-screen flex-col">
      <SiteHeader variant="default" backHref="/" backLabel="ホーム" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <article className="glass-panel space-y-6 p-6 sm:p-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-zinc-50">データについて</h1>
            <p className="text-sm text-zinc-400">
              Creator Radarで表示している数値の出所と、読み方を説明します。
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">利用しているデータ</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              動画タイトル、チャンネル名、再生数、公開日時などは、YouTubeが公開している情報（YouTube Data
              API）を利用しています。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">推定と実測</h2>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
              <p>
                <span className="font-medium text-zinc-300">推定</span>
                ：公開情報から算出した参考値です。計測データがまだ少ない動画に表示されます。
              </p>
              <p>
                <span className="font-medium text-emerald-300">実測</span>
                ：定期取得したスナップショットから算出した値です。時間の経過に応じて、より正確な推移を確認できます。
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">データの蓄積</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              動画ごとに計測データが増えると、実測推移グラフや期間別の増加数が表示されるようになります。計測開始直後は「準備中」「データ不足」と表示されることがあります。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">更新について</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              ランキングは定期的に更新されます。ホーム上部の「最終更新」で、最新の反映時刻を確認できます。
            </p>
          </section>

          <p className="text-sm text-zinc-500">
            詳しい使い方は
            <Link href="/about" className="mx-1 text-violet-300 hover:text-violet-200">
              Creator Radarについて
            </Link>
            もご覧ください。
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
