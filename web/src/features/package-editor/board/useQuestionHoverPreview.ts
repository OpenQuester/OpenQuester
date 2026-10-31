import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Owns the delayed mouse preview and cancels it on leave, press or unmount. */
export function useQuestionHoverPreview() {
  const anchor = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const show = () => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const left =
      r.right + 12 + width < window.innerWidth ? r.right + 12 : Math.max(8, r.left - 12 - width);
    setPos({ top: Math.max(8, Math.min(r.top, window.innerHeight - 420)), left });
  };

  return {
    anchor,
    pos,
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      clear();
      timer.current = window.setTimeout(show, 380);
    },
    onPointerLeave: () => {
      clear();
      setPos(null);
    },
    onPointerDown: () => {
      clear();
      setPos(null);
    },
  };
}
