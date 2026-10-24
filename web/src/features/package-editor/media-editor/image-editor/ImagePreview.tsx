import { mediaEditorStyles } from "../mediaEditorStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { mediaControlStyles } from "../MediaControls";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import type { RefObject, PointerEventHandler } from "react";

export function ImagePreview({
  viewport,
  viewportSize,
  dimensions,
  scale,
  canvas,
  start,
  move,
  endGesture,
  cancelGesture,
  zoom,
  setZoom,
  setCompare,
  cropDraft,
  dirty,
  ready,
  previewBytes,
}: {
  viewport: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  viewportSize: { width: number; height: number };
  dimensions: { width: number; height: number } | null;
  scale: number;
  start: PointerEventHandler<HTMLCanvasElement>;
  move: PointerEventHandler<HTMLCanvasElement>;
  endGesture: () => void;
  cancelGesture: () => void;
  zoom: number | null;
  setZoom: (zoom: number | null) => void;
  setCompare: (compare: boolean) => void;
  cropDraft: boolean;
  dirty: boolean;
  ready: boolean;
  previewBytes: number | undefined;
}) {
  const { t } = useTranslation();

  return (
    <div className={mediaEditorStyles.imagePreviewColumn}>
      <div ref={viewport} data-testid="image-viewport" className={mediaEditorStyles.imageViewport}>
        <div
          style={{
            width: Math.max(viewportSize.width, (dimensions?.width ?? 0) * scale),
            height: Math.max(viewportSize.height, (dimensions?.height ?? 0) * scale),
          }}
          className="grid place-items-center"
        >
          <canvas
            ref={canvas}
            tabIndex={0}
            role="img"
            aria-label={t("mediaEditor.canvas")}
            className="block touch-none text-accent outline-offset-4"
            style={{
              width: (dimensions?.width ?? 0) * scale,
              height: (dimensions?.height ?? 0) * scale,
              maxWidth: "none",
            }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={endGesture}
            onPointerCancel={cancelGesture}
          />
        </div>
      </div>
      <div className={layoutStyles.actions}>
        <Button aria-pressed={zoom === null} onClick={() => setZoom(null)}>
          {t("mediaEditor.fit")}
        </Button>
        <div className="flex items-center gap-1" role="group" aria-label={t("mediaEditor.zoom")}>
          <Button
            className={mediaControlStyles.iconButton}
            aria-label={t("mediaEditor.zoomOut")}
            disabled={scale <= 0.1}
            onClick={() => setZoom(Math.max(0.1, scale / 1.25))}
          >
            −
          </Button>
          <Button
            className="min-w-16 px-2 tabular-nums"
            title={t("mediaEditor.actualSize")}
            aria-label={t("mediaEditor.actualSize")}
            onClick={() => setZoom(1)}
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button
            className={mediaControlStyles.iconButton}
            aria-label={t("mediaEditor.zoomIn")}
            disabled={scale >= 4}
            onClick={() => setZoom(Math.min(4, scale * 1.25))}
          >
            +
          </Button>
        </div>
        <Button
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setCompare(true);
          }}
          onPointerUp={() => setCompare(false)}
          onPointerCancel={() => setCompare(false)}
          onBlur={() => setCompare(false)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setCompare(true);
            }
          }}
          onKeyUp={() => setCompare(false)}
        >
          {t("mediaEditor.compare")}
        </Button>
        <span className="text-sm text-muted" role="status">
          {dimensions && `${dimensions.width} × ${dimensions.height}`}
          {cropDraft
            ? ` · ${t("mediaEditor.applyCrop")}`
            : dirty && !ready
              ? ` · ${t("mediaEditor.updating")}`
              : previewBytes != null && dirty
                ? ` · ${Math.round(previewBytes / 1024)} KB`
                : ""}
        </span>
      </div>
    </div>
  );
}
