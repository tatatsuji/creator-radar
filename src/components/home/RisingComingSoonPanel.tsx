import { BUZZ_VIDEOS_LABEL, RISING_VIDEOS_LABEL } from "@/lib/home/copy";

interface RisingComingSoonPanelProps {
  onViewBuzz: () => void;
}

export function RisingComingSoonPanel({ onViewBuzz }: RisingComingSoonPanelProps) {
  return (
    <section
      id="home-mode-panel-rising"
      role="tabpanel"
      aria-labelledby="home-mode-tab-rising"
      className="glass-panel mx-auto max-w-2xl space-y-5 px-5 py-8 text-center sm:px-8 sm:py-10"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 text-xl font-bold text-violet-200">
        CR
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold text-zinc-50 sm:text-2xl">
          {RISING_VIDEOS_LABEL}を検知中
        </h2>
        <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
          再生速度・加速率・チャンネル規模との比率を継続計測し、
          急成長の兆候が確認できた動画を表示します。
        </p>
        <p className="text-xs leading-relaxed text-zinc-500 sm:text-sm">
          データの精度を高めるため、現在計測を継続しています。
        </p>
      </div>

      <button
        type="button"
        onClick={onViewBuzz}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 sm:w-auto"
      >
        {BUZZ_VIDEOS_LABEL}を見る
      </button>
    </section>
  );
}
