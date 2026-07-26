"use client";

import { useCallback, useRef } from "react";

import { HOME_MODES, type HomeMode } from "@/lib/home/mode";

interface HomeModeTabsProps {
  value: HomeMode;
  onChange: (mode: HomeMode) => void;
}

export function HomeModeTabs({ value, onChange }: HomeModeTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = useCallback((index: number) => {
    tabRefs.current[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        const nextIndex = (index + 1) % HOME_MODES.length;
        onChange(HOME_MODES[nextIndex].id);
        focusTab(nextIndex);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        const nextIndex = (index - 1 + HOME_MODES.length) % HOME_MODES.length;
        onChange(HOME_MODES[nextIndex].id);
        focusTab(nextIndex);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        onChange(HOME_MODES[0].id);
        focusTab(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        const lastIndex = HOME_MODES.length - 1;
        onChange(HOME_MODES[lastIndex].id);
        focusTab(lastIndex);
      }
    },
    [focusTab, onChange],
  );

  return (
    <div className="-mx-1 overflow-x-auto scroll-tabs px-1">
      <div
        className="glass-panel inline-flex min-w-max gap-1 p-1"
        role="tablist"
        aria-label="表示モード"
      >
        {HOME_MODES.map((mode, index) => {
          const isActive = value === mode.id;

          return (
            <button
              key={mode.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`home-mode-tab-${mode.id}`}
              aria-selected={isActive}
              aria-controls={`home-mode-panel-${mode.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(mode.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`min-h-11 shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
