import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";

export interface Spot {
  x: number;
  y: number;
}

/** Point answers within this share of the picture's width count by default. */
export const DEFAULT_POINT_RADIUS = 0.05;

/** "x,y" as the server expects point answers. */
export const pointAnswer = (p: Spot) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

/**
 * A picture to click on for point answers. Shows the right spot with its
 * radius when `target` is set (the reveal, the showman, the editor).
 */
export function PointPicker({
  src,
  onPick,
  target,
  radius = DEFAULT_POINT_RADIUS,
  picked,
  className,
}: {
  src: string;
  onPick?: (spot: Spot) => void;
  target?: Spot | null;
  radius?: number | null;
  picked?: Spot | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<Spot | null>(null);
  // Height ÷ width, so the radius (a share of the width) draws as a circle.
  const [ratio, setRatio] = useState(1);
  const spotOf = (e: MouseEvent<HTMLDivElement>): Spot => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const r = radius ?? DEFAULT_POINT_RADIUS;
  return (
    <div
      className={cn(
        "relative inline-block max-w-full overflow-hidden rounded-lg",
        onPick && "cursor-crosshair",
        className,
      )}
      onClick={onPick ? (e) => onPick(spotOf(e)) : undefined}
      onMouseMove={onPick ? (e) => setHover(spotOf(e)) : undefined}
      onMouseLeave={() => setHover(null)}
      role={onPick ? "button" : undefined}
      aria-label={onPick ? t("point.pick") : undefined}
      data-testid="point-picker"
    >
      <img
        src={src}
        alt={t("point.picture")}
        className="block max-h-[60vh] max-w-full"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth) setRatio(img.naturalHeight / img.naturalWidth);
        }}
      />
      {target && (
        <span
          className="pointer-events-none absolute rounded-full border-4 border-success bg-success/20"
          style={{
            left: `${(target.x - r) * 100}%`,
            top: `${(target.y - r / ratio) * 100}%`,
            width: `${r * 200}%`,
            height: `${(r * 200) / ratio}%`,
          }}
          data-testid="point-target"
        />
      )}
      {(picked ?? hover) && (
        <span
          className={cn(
            "pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow",
            picked ? "bg-accent" : "bg-accent/50",
          )}
          style={{ left: `${(picked ?? hover)!.x * 100}%`, top: `${(picked ?? hover)!.y * 100}%` }}
        />
      )}
    </div>
  );
}
