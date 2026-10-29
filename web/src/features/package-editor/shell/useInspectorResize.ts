import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const MIN_MAIN_WIDTH = 480;
const STEP = 16;

/** Keep the desired inspector width in this editor shell, bounded by available space. */
export function useInspectorResize() {
  const container = useRef<HTMLDivElement>(null);
  const outline = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    container.current = node;
  }, []);
  const outlineRef = useCallback((node: HTMLElement | null) => {
    outline.current = node;
  }, []);
  const handle = useCallback((node: HTMLDivElement | null) => {
    if (!node) drag.current = null;
  }, []);
  const [desired, setDesired] = useState(360);
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      if (!element.clientWidth) return;
      const outlineWidth = outline.current?.getBoundingClientRect().width ?? 0;
      setAvailable(Math.floor(element.clientWidth - outlineWidth - MIN_MAIN_WIDTH));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (outline.current) observer.observe(outline.current);
    return () => observer.disconnect();
  }, []);

  const fits = available == null || available >= MIN_WIDTH;
  const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available ?? MAX_WIDTH));
  const width = Math.min(desired, max);
  const setWidth = (value: number) => setDesired(Math.min(max, Math.max(MIN_WIDTH, value)));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    drag.current = { pointerId: event.pointerId, x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (start?.pointerId === event.pointerId) setWidth(start.width + start.x - event.clientX);
  };
  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = width + STEP;
        break;
      case "ArrowRight":
        next = width - STEP;
        break;
      case "Home":
        next = MIN_WIDTH;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setWidth(next);
  };

  return {
    containerRef,
    outlineRef,
    handle,
    fits,
    width,
    max,
    min: MIN_WIDTH,
    onPointerDown,
    onPointerMove,
    endPointer,
    onKeyDown,
  };
}
