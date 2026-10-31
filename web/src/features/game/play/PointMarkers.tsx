import { useTranslation } from "react-i18next";
import type { PointMarker } from "./PointPicker";
import { questionStyles } from "./question/questionStyles";
import { cn } from "@/lib/cn";

/** Every nickname stays next to its actual point; coincident answers may overlap. */
export function PointMarkers({
  markers,
  percent,
}: {
  markers: PointMarker[];
  percent: (value: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <>
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
              "z-20",
              marker.correct === true
                ? "bg-success"
                : marker.correct === false
                  ? "bg-danger"
                  : "bg-info",
            )}
            style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
            data-testid="point-answer-dot"
          />
          <span
            className="pointer-events-auto absolute z-10 w-40 max-w-full"
            data-testid="point-answer-label"
            style={{
              left: `clamp(0px, calc(${marker.x * 100}% ${marker.x > 0.5 ? "- 0.75rem - min(10rem, 100%)" : "+ 0.75rem"}), max(0px, calc(100% - min(10rem, 100%))))`,
              top: `clamp(0px, calc(${marker.y * 100}% ${marker.y > 0.85 ? "- 1.75rem" : "+ 0.5rem"}), max(0px, calc(100% - 1.5rem)))`,
            }}
            title={marker.name}
          >
            <span className="inline-block max-w-full truncate rounded-sm bg-surface/95 px-1.5 py-0.5 text-xs font-semibold text-text shadow">
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
    </>
  );
}
