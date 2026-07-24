import Link from "next/link";

export default function VideoNotFound() {
  return (
    <div className="app-background flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel max-w-md px-8 py-10 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">動画が見つかりません</h1>
        <p className="mt-2 text-sm text-zinc-400">
          指定された動画は存在しないか、取得できませんでした。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-2xl bg-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
        >
          ランキングに戻る
        </Link>
      </div>
    </div>
  );
}
