import { useState } from "react";

import { cn } from "@/lib/cn";

import { initials } from "@/game/selectors";

export function Avatar({
  name,
  src,
  size = 44,
  muted,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  // A missing or broken picture falls back to initials instead of an empty circle.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src && failed !== src;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-avatar font-semibold",
        muted ? "text-muted" : "text-text",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
