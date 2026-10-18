import { PointMarkers } from "./PointMarkers";
import "./PointPicker.css";
import { questionStyles } from "./question/questionStyles";
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { mapUrl } from "@/lib/urlMappings";

export interface Spot {
  x: number;
  y: number;
}

export type PointMarker = Spot & { id: number; name: string; correct: boolean | null };
const NO_MARKERS: PointMarker[] = [];

/** Point answers within this share of the picture's width count by default. */
export const DEFAULT_POINT_RADIUS = 0.05;

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
  markers = NO_MARKERS,
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
  markers?: PointMarker[];
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
  const percentFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumSignificantDigits: 6 }),
    [i18n.language],
  );
  const percent = (value: number) => percentFormatter.format(value * 100);
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
  const controls = onPick
    ? {
        onClick: (e: MouseEvent<HTMLDivElement>) => onPick(spotOf(e)),
        onMouseMove: (e: MouseEvent<HTMLDivElement>) => setHover(spotOf(e)),
        onKeyDown,
        onFocus: () => setHover((h) => h ?? { x: 0.5, y: 0.5 }),
        tabIndex: 0,
        role: "button",
        "aria-label": t("point.pick"),
        "aria-description":
          [cursorDescription, targetDescription].filter(Boolean).join(" ") || undefined,
      }
    : {};

  return (
    <div
      className={cn(questionStyles.picture, onPick && questionStyles.pointPicker, className)}
      style={
        fitFrame && imageDimensions
          ? { width: `min(100%, calc(100cqh * ${imageDimensions.width / imageDimensions.height}))` }
          : undefined
      }
      {...controls}
      onMouseLeave={() => setHover(null)}
      data-testid="point-picker"
    >
      <img
        src={mapUrl(src)}
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
      {!onPick && (
        <PointDescription targetDescription={targetDescription} picked={picked} percent={percent} />
      )}
      <PointOverlay target={target} radius={r} picked={picked} hover={hover} />
      <PointMarkers markers={markers} percent={percent} />
    </div>
  );
}

function PointDescription({
  targetDescription,
  picked,
  percent,
}: {
  targetDescription?: string;
  picked?: Spot | null;
  percent: (value: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <span className="sr-only">
      {targetDescription}
      {picked && t("point.pickedDescription", { x: percent(picked.x), y: percent(picked.y) })}
    </span>
  );
}

function PointOverlay({
  target,
  radius,
  picked,
  hover,
}: {
  target?: Spot | null;
  radius: number;
  picked?: Spot | null;
  hover: Spot | null;
}) {
  const cursor = picked ?? hover;
  return (
    <>
      {target && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <span
            className={questionStyles.correctPoint}
            style={{
              left: `${target.x * 100}%`,
              top: `${target.y * 100}%`,
              width: `${radius * 200}%`,
            }}
            data-testid="point-target"
          />
        </span>
      )}
      {cursor && (
        <span
          className={cn(
            questionStyles.chosenPoint,
            picked ? "bg-info motion-safe:animate-pulse" : "bg-accent/50",
          )}
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          data-testid={picked ? "point-picked" : undefined}
        />
      )}
    </>
  );
}
