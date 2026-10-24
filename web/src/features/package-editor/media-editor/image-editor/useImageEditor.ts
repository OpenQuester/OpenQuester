import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useReducer,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { MediaToolProps } from "../mediaEditorTypes";
import {
  imageChanged,
  initialImageEdits,
  fullImage,
  imageTools,
  type ImageTool,
  type ImageAnnotation,
  type ImageEdits,
  type ImagePoint,
  type ImageCrop,
} from "../mediaEdits";
import { imageSize } from "../renderImage";
import { useImagePreview } from "./useImagePreview";
import { useImageCanvas } from "./useImageCanvas";
import { initialImageHistory, imageHistoryReducer } from "./imageHistory";
import { imagePoint, annotationAt, dragAnnotation } from "./imageInteraction";

/** A form-local editing session: committed history, transient gestures and selection. */
export function useImageEditor({ file, mime, controlRef, onStatus }: MediaToolProps) {
  const { t } = useTranslation();
  const [history, dispatchHistory] = useReducer(
    imageHistoryReducer,
    undefined,
    initialImageHistory,
  );
  const [draft, setDraft] = useState<ImageEdits | null>(null);
  const edits = draft ?? history.now;
  const [tool, setTool] = useState<ImageTool>("select");
  const toolButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const [cropDraft, setCropDraft] = useState<ImageCrop | null>(null);
  const cropStart = useRef<ImagePoint | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [color, setColor] = useState("#ef4444");
  const [sizes, setSizes] = useState({ pen: 6, arrow: 6, rectangle: 6, text: 48, blur: 20 });
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);
  const gesture = useRef<{
    start: ImagePoint;
    before: ImageEdits;
    annotation: ImageAnnotation;
    move: boolean;
  } | null>(null);
  const pending = useRef<ImageEdits | null>(null);
  const dirty = imageChanged(edits);
  const { bitmap, preview, supported, blurSupported, error, setError, setAttempt } =
    useImagePreview(file, mime, edits, draft);
  const ready =
    supported && !!bitmap && !error && !cropDraft && (!dirty || preview?.edits === edits);
  const selectedAnnotation = edits.annotations.find((a) => a.id === selected);
  const chooseTool = useCallback(
    (name: (typeof imageTools)[number]) => {
      if (!supported || (name === "blur" && !blurSupported) || gesture.current || cropStart.current)
        return false;
      setTool(name);
      setCropDraft(null);
      if (name !== "select") setSelected(null);
      return true;
    },
    [supported, blurSupported],
  );

  const commit = (next: ImageEdits) => {
    setCropDraft(null);
    setDraft(null);
    pending.current = null;
    setError(false);
    dispatchHistory({ type: "commit", edits: next });
  };
  const stage = (next: ImageEdits) => {
    pending.current = next;
    setDraft(next);
  };
  const finish = () => {
    if (pending.current) commit(pending.current);
  };
  const undo = useCallback(() => {
    setCropDraft(null);
    setDraft(null);
    pending.current = null;
    dispatchHistory({ type: "undo" });
  }, []);
  const redo = useCallback(() => {
    setCropDraft(null);
    dispatchHistory({ type: "redo" });
  }, []);

  useEffect(() => {
    onStatus({
      ready,
      dirty: dirty || !!cropDraft,
      ...(error ? { error: "processingFailed" } : {}),
    });
  }, [ready, dirty, cropDraft, error, onStatus]);
  useEffect(() => {
    controlRef.current = {
      undo: (redoing) => (redoing ? redo() : undo()),
      shortcut: (key) => {
        const name = /^[1-7]$/.test(key) ? imageTools[Number(key) - 1] : undefined;
        if (!name || !chooseTool(name)) return false;
        toolButtons.current[Number(key) - 1]?.focus();
        return true;
      },
      retry: () => {
        setError(false);
        setAttempt((n) => n + 1);
      },
      save: async () => {
        if (!ready || (dirty && preview?.edits !== edits)) throw new Error("processingFailed");
        return {
          file: dirty ? preview!.file : { ...file, preserveEncoding: true },
          geometryChanged: edits.rotation % 360 !== 0 || !!edits.crop,
        };
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [
    controlRef,
    ready,
    dirty,
    preview,
    edits,
    file,
    undo,
    redo,
    chooseTool,
    setError,
    setAttempt,
  ]);

  const { viewport, canvas, viewportSize } = useImageCanvas({
    bitmap,
    edits,
    compare,
    preview,
    selectedAnnotation,
    cropDraft,
    tool,
    supported,
    setError,
  });

  const position = (event: PointerEvent<HTMLCanvasElement>, clamp = true) =>
    imagePoint(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
      bitmap!,
      edits,
      clamp,
    );
  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!bitmap || compare) return;
    const point = position(e, false);
    const crop = edits.crop ?? fullImage;
    if (
      point.x < crop.x ||
      point.x > crop.x + crop.width ||
      point.y < crop.y ||
      point.y > crop.y + crop.height
    ) {
      if (tool === "select") setSelected(null);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    if (tool === "crop") {
      cropStart.current = point;
      return;
    }
    if (tool === "select") {
      const hit = annotationAt(edits.annotations, point);
      setSelected(hit?.id ?? null);
      if (hit) gesture.current = { start: point, before: history.now, annotation: hit, move: true };
      return;
    }
    const a: ImageAnnotation = {
      id: crypto.randomUUID(),
      tool,
      points: [point, point],
      color,
      size: sizes[tool],
      text: text || t("mediaEditor.text"),
    };
    setSelected(null);
    gesture.current = { start: point, before: history.now, annotation: a, move: false };
    stage({ ...history.now, annotations: [...history.now.annotations, a] });
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (cropStart.current) {
      const p = cropStart.current,
        q = position(e);
      setCropDraft({
        x: Math.min(p.x, q.x),
        y: Math.min(p.y, q.y),
        width: Math.abs(q.x - p.x),
        height: Math.abs(q.y - p.y),
      });
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const point = position(e);
    let a: ImageAnnotation;
    if (g.move) {
      a = dragAnnotation(g.annotation, g.start, point);
    } else {
      a = {
        ...g.annotation,
        points: g.annotation.tool === "pen" ? [...g.annotation.points, point] : [g.start, point],
      };
      g.annotation = a;
    }
    stage({
      ...g.before,
      annotations: g.move
        ? g.before.annotations.map((x) => (x.id === a.id ? a : x))
        : [...g.before.annotations, a],
    });
  };
  const updateSelected = (patch: Partial<ImageAnnotation>, transient = false) => {
    const next = {
      ...edits,
      annotations: edits.annotations.map((a) => (a.id === selected ? { ...a, ...patch } : a)),
    };
    if (transient) stage(next);
    else commit(next);
  };
  const visibleEdits = compare ? initialImageEdits() : edits;
  const dimensions = bitmap
    ? imageSize(bitmap.width, bitmap.height, visibleEdits.rotation, visibleEdits.crop)
    : null;
  const fitZoom = dimensions
    ? Math.min(1, viewportSize.width / dimensions.width, viewportSize.height / dimensions.height)
    : 1;
  const scale = zoom ?? fitZoom;
  const crop = cropDraft ?? edits.crop ?? fullImage;
  const canCrop = bitmap && crop.width * bitmap.width >= 1 && crop.height * bitmap.height >= 1;
  const deleteSelected = () => {
    commit({ ...edits, annotations: edits.annotations.filter((a) => a.id !== selected) });
    setSelected(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]:not([contenteditable=false])",
      )
    )
      return;
    if (e.key === "Delete" && selected) {
      e.preventDefault();
      deleteSelected();
    }
    if (selectedAnnotation && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const dx = e.key === "ArrowLeft" ? -0.005 : e.key === "ArrowRight" ? 0.005 : 0;
      const dy = e.key === "ArrowUp" ? -0.005 : e.key === "ArrowDown" ? 0.005 : 0;
      updateSelected({
        points: selectedAnnotation.points.map((p) => ({
          x: Math.max(0, Math.min(1, p.x + dx)),
          y: Math.max(0, Math.min(1, p.y + dy)),
        })),
      });
    }
  };
  const endGesture = () => {
    cropStart.current = null;
    if (gesture.current && !gesture.current.move) {
      setSelected(gesture.current.annotation.id);
      setTool("select");
    }
    gesture.current = null;
    finish();
  };
  const cancelGesture = () => {
    cropStart.current = null;
    setCropDraft(null);
    gesture.current = null;
    pending.current = null;
    setDraft(null);
  };
  const propertyTool =
    selectedAnnotation?.tool ?? (tool === "select" || tool === "crop" ? null : tool);
  return {
    supported,
    tool,
    onKeyDown,
    toolbar: {
      tool,
      toolButtons,
      blurSupported,
      chooseTool,
      canUndo: !!history.past.length,
      canRedo: !!history.future.length,
      undo,
      redo,
    },
    preview: {
      viewport,
      canvas,
      viewportSize,
      dimensions,
      scale,
      start,
      move,
      endGesture,
      cancelGesture,
      zoom,
      setZoom,
      setCompare,
      cropDraft: !!cropDraft,
      dirty,
      ready,
      previewBytes: preview?.file.bytes.length,
    },
    rotation: {
      rotation: edits.rotation,
      onChange: (rotation: number, transient = false) =>
        (transient ? stage : commit)({ ...edits, rotation }),
      onFinish: finish,
    },
    crop: {
      crop,
      canApply: !!cropDraft && !!canCrop,
      canReset: !!edits.crop || !!cropDraft,
      onChange: setCropDraft,
      onApply: () => {
        commit({ ...edits, crop });
        setTool("select");
      },
      onReset: () => commit({ ...edits, crop: null }),
    },
    output: {
      blur: edits.blur,
      quality: edits.quality,
      blurSupported,
      onBlurChange: (blur: number) => stage({ ...edits, blur }),
      onFinish: finish,
      onQualityChange: (quality: ImageEdits["quality"]) =>
        commit({ ...edits, quality, qualityChanged: true }),
    },
    annotations: {
      propertyTool,
      showText: tool === "text" || selectedAnnotation?.tool === "text",
      color: selectedAnnotation?.color ?? color,
      size: selectedAnnotation?.size ?? (propertyTool ? sizes[propertyTool] : 1),
      text: selectedAnnotation?.tool === "text" ? selectedAnnotation.text : text,
      annotations: edits.annotations,
      selected: selectedAnnotation?.id ?? null,
      onColor: (value: string) => {
        setColor(value);
        if (selected) updateSelected({ color: value });
      },
      onSize: (size: number) => {
        if (selected) updateSelected({ size }, true);
        else if (propertyTool) setSizes({ ...sizes, [propertyTool]: size });
      },
      onText: (value: string) => {
        setText(value);
        if (selectedAnnotation?.tool === "text") updateSelected({ text: value }, true);
      },
      onSelect: (id: string | null) => {
        setSelected(id);
        setTool("select");
      },
      onDelete: deleteSelected,
      onFinish: finish,
    },
  };
}
