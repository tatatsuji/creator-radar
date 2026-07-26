import Link from "next/link";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StatePanel } from "@/components/ui/StatePanel";
import { BUZZ_VIDEOS_LABEL } from "@/lib/home/copy";

export default function VideoNotFound() {
  return (
    <div className="app-background flex min-h-screen flex-col">
      <SiteHeader variant="default" backHref="/" backLabel={BUZZ_VIDEOS_LABEL} />

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 sm:px-6">
        <StatePanel
          tone="empty"
          title="動画が見つかりません"
          description="指定された動画は存在しないか、現在取得できません。URLを確認するか、ランキングから再度お試しください。"
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
            >
              {BUZZ_VIDEOS_LABEL}に戻る
            </Link>
          }
        />
      </main>

      <SiteFooter />
    </div>
  );
}
