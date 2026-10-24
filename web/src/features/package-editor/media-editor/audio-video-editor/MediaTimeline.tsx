import { mediaEditorStyles } from "../mediaEditorStyles";
import { useTranslation } from "react-i18next";
import type { AudioVideoEditorState } from "./useAudioVideoEditor";
import type { PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "../mediaEdits";
import { fadeEnvelopePoints, timelineKeyPosition } from "./timeline";
export function MediaTimeline({ editor }: { editor: AudioVideoEditorState }) {
  const { t } = useTranslation();
  const { meta, edits, position, video, frames, peaks, valid, seek } = editor;
  const seekAtPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!meta) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width) seek(((e.clientX - rect.left) / rect.width) * meta.duration);
  };

  if (!meta || !edits) return null;
  return (
    <div
      data-testid="media-timeline"
      role="slider"
      tabIndex={0}
      aria-label={t("mediaEditor.position")}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={meta.duration}
      aria-valuenow={position}
      aria-valuetext={formatTime(position)}
      className={cn(mediaEditorStyles.timeline, video ? "h-20" : "h-40")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAtPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAtPointer(e);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          seekAtPointer(e);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onKeyDown={(e) => {
        const next = timelineKeyPosition(e.key, e.shiftKey, position, meta.duration);
        if (next !== null) {
          e.preventDefault();
          e.stopPropagation();
          seek(next);
        }
      }}
    >
      {video ? (
        <div className="pointer-events-none flex h-full">
          {frames.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="h-full min-w-0 flex-1 object-cover"
            />
          ))}
        </div>
      ) : (
        <svg
          viewBox="0 0 512 100"
          preserveAspectRatio="none"
          className="pointer-events-none h-full w-full text-accent"
          role="img"
          aria-label={t("mediaEditor.waveform")}
        >
          {peaks.map((v, i) => (
            <line
              key={i}
              x1={i + 0.5}
              x2={i + 0.5}
              y1={50 - v * 44}
              y2={50 + v * 44}
              stroke="currentColor"
            />
          ))}
        </svg>
      )}
      {valid && (
        <>
          <div
            className={mediaEditorStyles.trimBefore}
            style={{ width: (edits.start / meta.duration) * 100 + "%" }}
          />
          <div
            className={mediaEditorStyles.trimAfter}
            style={{ width: (1 - edits.end / meta.duration) * 100 + "%" }}
          />
          <div
            className={mediaEditorStyles.retainedInterval}
            style={{
              left: (edits.start / meta.duration) * 100 + "%",
              width: ((edits.end - edits.start) / meta.duration) * 100 + "%",
            }}
          />
        </>
      )}
      {!video && valid && (edits.fadeIn > 0 || edits.fadeOut > 0) && (
        <svg
          data-testid="fade-envelope"
          viewBox={`0 0 ${meta.duration} 100`}
          preserveAspectRatio="none"
          className={mediaEditorStyles.fadeEnvelope}
          role="img"
          aria-label={t("mediaEditor.fadeEnvelope")}
        >
          <polyline
            points={fadeEnvelopePoints(edits)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div
        className={mediaEditorStyles.playhead}
        style={{ left: (position / meta.duration) * 100 + "%" }}
      >
        <span className={mediaEditorStyles.playheadHandle} />
      </div>
    </div>
  );
}
