"use client";

import { useState } from "react";

interface RemoteImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  width?: number;
  height?: number;
}

export function RemoteImage({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  width,
  height,
}: RemoteImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.04] text-xs text-zinc-500 ${fallbackClassName}`}
        role="img"
        aria-label={alt}
      >
        画像なし
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}
