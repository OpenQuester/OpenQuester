import { questionStyles } from "./question/questionStyles";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
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

/** Arrow keys move the keyboard cursor this share of the picture; Shift moves 5× as far. */
const KEY_STEP = 0.02;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A picture to click on for point answers. From the keyboard, focus it, move
 * the cursor with the arrow keys and pick with Enter or Space. Shows the right spot with its
 * radius when `target` is set (the reveal, the showman, the editor).
 */
export function PointPicker({
  src,
  onPick,
  target,
  radius = DEFAULT_POINT_RADIUS,
  picked,
  className,
  onImageLoad,
}: {
  src: string;
  onPick?: (spot: Spot) => void;
  target?: Spot | null;
  radius?: number | null;
  picked?: Spot | null;
  className?: string;
  onImageLoad?: (width: number, height: number) => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<Spot | null>(null);
  const spotOf = (e: MouseEvent<HTMLDivElement>): Spot => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const r = radius ?? DEFAULT_POINT_RADIUS;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const at = hover ?? { x: 0.5, y: 0.5 };

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(at);
      return;
    }

    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const moves: Record<string, Spot> = {
      ArrowLeft: { x: at.x - step, y: at.y },
      ArrowRight: { x: at.x + step, y: at.y },
      ArrowUp: { x: at.x, y: at.y - step },
      ArrowDown: { x: at.x, y: at.y + step },
    };
    const next = moves[e.key];
    if (!next) return;

    e.preventDefault();
    setHover({ x: clamp(next.x), y: clamp(next.y) });
  };

  return (
    <div
      className={cn(questionStyles.picture, onPick && questionStyles.pointPicker, className)}
      onClick={onPick ? (e) => onPick(spotOf(e)) : undefined}
      onMouseMove={onPick ? (e) => setHover(spotOf(e)) : undefined}
      onMouseLeave={() => setHover(null)}
      onKeyDown={onPick ? onKeyDown : undefined}
      onFocus={onPick ? () => setHover((h) => h ?? { x: 0.5, y: 0.5 }) : undefined}
      tabIndex={onPick ? 0 : undefined}
      role={onPick ? "button" : undefined}
      aria-label={onPick ? t("point.pick") : undefined}
      aria-description={
        onPick && hover
          ? t("point.cursor", { x: Math.round(hover.x * 100), y: Math.round(hover.y * 100) })
          : undefined
      }
      data-testid="point-picker"
    >
      <img
        src={src}
        alt={t("point.picture")}
        className="block max-h-[60vh] max-w-full"
        onLoad={(event) =>
          onImageLoad?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
        }
      />
      {target && (
        <span
          className={questionStyles.correctPoint}
          style={{
            left: `${target.x * 100}%`,
            top: `${target.y * 100}%`,
            width: `${r * 200}%`,
          }}
          data-testid="point-target"
        />
      )}
      {(picked ?? hover) && (
        <span
          className={cn(questionStyles.chosenPoint, picked ? "bg-accent" : "bg-accent/50")}
          style={{ left: `${(picked ?? hover)!.x * 100}%`, top: `${(picked ?? hover)!.y * 100}%` }}
        />
      )}
    </div>
  );
}
