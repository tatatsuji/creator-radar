import type { ReactNode } from "react";

interface VideoCollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function VideoCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: VideoCollapsibleSectionProps) {
  return (
    <details
      className="group rounded-2xl border border-white/[0.08] bg-white/[0.02]"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-200">{title}</p>
            {description ? (
              <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
            ) : null}
          </div>
          <span
            className="shrink-0 text-xs text-violet-300 transition group-open:rotate-180"
            aria-hidden
          >
            ▼
          </span>
        </div>
      </summary>
      <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5 sm:py-5">
        {children}
      </div>
    </details>
  );
}
