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
  markers = [],
  className,
  imageClassName,
  fitFrame = false,
  onImageLoad,
}: {
  src: string;
  onPick?: (spot: Spot) => void;
  target?: Spot | null;
  radius?: number | null;
  picked?: Spot | null;
  markers?: (Spot & { id: number; name: string; correct: boolean | null })[];
  className?: string;
  imageClassName?: string;
  /** Fit the image itself to the surrounding media frame, keeping click coordinates on the image. */
  fitFrame?: boolean;
  onImageLoad?: (width: number, height: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState<Spot | null>(null);
  const [dimensions, setDimensions] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const spotOf = (e: MouseEvent<HTMLDivElement>): Spot => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const r = radius ?? DEFAULT_POINT_RADIUS;
  const percent = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumSignificantDigits: 6 }).format(value * 100);
  const imageDimensions = dimensions?.src === src ? dimensions : null;
  const targetDescription = target
    ? [
        t("point.targetDescription", {
          x: percent(target.x),
          y: percent(target.y),
          radius: percent(r),
        }),
        imageDimensions
          ? t("point.imageDimensions", imageDimensions)
          : t("point.imageDimensionsUnavailable"),
      ].join(" ")
    : undefined;
  const cursorDescription =
    onPick && hover
      ? t("point.cursor", { x: Math.round(hover.x * 100), y: Math.round(hover.y * 100) })
      : undefined;

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
      style={
        fitFrame && imageDimensions
          ? { width: `min(100%, calc(100cqh * ${imageDimensions.width / imageDimensions.height}))` }
          : undefined
      }
      onClick={onPick ? (e) => onPick(spotOf(e)) : undefined}
      onMouseMove={onPick ? (e) => setHover(spotOf(e)) : undefined}
      onMouseLeave={() => setHover(null)}
      onKeyDown={onPick ? onKeyDown : undefined}
      onFocus={onPick ? () => setHover((h) => h ?? { x: 0.5, y: 0.5 }) : undefined}
      tabIndex={onPick ? 0 : undefined}
      role={onPick ? "button" : undefined}
      aria-label={onPick ? t("point.pick") : undefined}
      aria-description={
        onPick
          ? [cursorDescription, targetDescription].filter(Boolean).join(" ") || undefined
          : undefined
      }
      data-testid="point-picker"
    >
      <img
        src={src}
        alt={t("point.picture")}
        className={cn(
          "block max-h-[60vh] max-w-full rounded-lg",
          fitFrame && imageDimensions && "w-full max-h-none",
          imageClassName,
        )}
        onLoad={(event) => {
          const image = event.currentTarget;
          const { naturalWidth: width, naturalHeight: height } = image;
          if ((!image.currentSrc || image.currentSrc === image.src) && width > 0 && height > 0)
            setDimensions({ src, width, height });
          onImageLoad?.(width, height);
        }}
        onError={() => setDimensions((current) => (current?.src === src ? null : current))}
      />
      {targetDescription && !onPick && <span className="sr-only">{targetDescription}</span>}
      {picked && !onPick && (
        <span className="sr-only">
          {t("point.pickedDescription", { x: percent(picked.x), y: percent(picked.y) })}
        </span>
      )}
      {target && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <span
            className={questionStyles.correctPoint}
            style={{
              left: `${target.x * 100}%`,
              top: `${target.y * 100}%`,
              width: `${r * 200}%`,
            }}
            data-testid="point-target"
          />
        </span>
      )}
      {(picked ?? hover) && (
        <span
          className={cn(
            questionStyles.chosenPoint,
            picked ? "bg-info motion-safe:animate-pulse" : "bg-accent/50",
          )}
          style={{ left: `${(picked ?? hover)!.x * 100}%`, top: `${(picked ?? hover)!.y * 100}%` }}
          data-testid={picked ? "point-picked" : undefined}
        />
      )}
      {markers.map((marker) => (
        <span
          key={marker.id}
          className="pointer-events-none absolute inset-0"
          data-testid="point-answer-marker"
        >
          <span
            aria-hidden
            className={cn(
              questionStyles.chosenPoint,
              "motion-safe:animate-pulse",
              marker.correct === true ? "bg-success" : "bg-info",
            )}
            style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
            data-testid="point-answer-dot"
          />
          <span
            aria-hidden
            className={cn("absolute w-32 max-w-full", marker.x > 0.5 && "text-right")}
            style={{
              left: `clamp(0px, calc(${marker.x * 100}% ${marker.x > 0.5 ? "- 0.75rem - min(8rem, 100%)" : "+ 0.75rem"}), max(0px, calc(100% - min(8rem, 100%))))`,
              top: `clamp(0px, calc(${marker.y * 100}% ${marker.y > 0.85 ? "- 1.75rem" : "+ 0.5rem"}), max(0px, calc(100% - 1.5rem)))`,
            }}
            data-testid="point-answer-label"
          >
            <span className="inline-block max-w-full truncate rounded-sm bg-surface px-1.5 py-0.5 text-xs font-semibold text-text shadow">
              {marker.name}
            </span>
          </span>
          <span className="sr-only">
            {t("point.answerDescription", {
              name: marker.name,
              x: percent(marker.x),
              y: percent(marker.y),
            })}
            {marker.correct == null
              ? ""
              : ` : ${t(marker.correct ? "judge.correct" : "judge.wrong")}`}
          </span>
        </span>
      ))}
    </div>
  );
}
