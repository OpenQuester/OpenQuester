import { useEffect, useRef, useState, type DragEvent } from "react";

/**
 * Native drag and drop for the board and outline. The dragged item lives in
 * module state because dragover handlers can't read dataTransfer contents.
 * Touch screens use the Move dialog instead.
 */
export type DragItem =
  { kind: "question"; id: string } | { kind: "theme"; id: string } | { kind: "round"; id: string };

let current: DragItem | null = null;
const listeners = new Set<(d: DragItem | null) => void>();

function setCurrent(d: DragItem | null) {
  current = d;
  for (const l of listeners) l(d);
}

export const dragging = () => current;

/** Re-renders while something is being dragged, to show drop zones. */
export function useDragging(): DragItem | null {
  const [d, setD] = useState(current);
  useEffect(() => {
    listeners.add(setD);
    return () => void listeners.delete(setD);
  }, []);
  return d;
}

export function dragSource(item: DragItem, enabled = true) {
  if (!enabled) return {};
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      // Firefox needs data to start a drag.
      e.dataTransfer.setData("text/plain", `${item.kind}:${item.id}`);
      // Let the browser take its snapshot before the source restyles.
      window.setTimeout(() => setCurrent(item), 0);
    },
    onDragEnd: () => setCurrent(null),
  };
}

export type Edge = "before" | "after";

/**
 * A drop target that accepts some kinds and reports which half of the element
 * the pointer is over. `onDrop` returns nothing; the target resets itself.
 */
export function useDropTarget({
  accepts,
  axis = "x",
  onDrop,
  onHold,
}: {
  accepts: (d: DragItem) => boolean;
  axis?: "x" | "y" | "none";
  onDrop: (d: DragItem, edge: Edge) => void;
  /** Called once when a drag rests over the target, e.g. to open a round. */
  onHold?: (d: DragItem) => void;
}) {
  const [over, setOver] = useState<Edge | null>(null);
  const hold = useRef<number | null>(null);
  const clearHold = () => {
    if (hold.current != null) window.clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => clearHold, []);

  const edgeOf = (e: DragEvent): Edge => {
    if (axis === "none") return "after";
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return axis === "x"
      ? e.clientX < r.left + r.width / 2
        ? "before"
        : "after"
      : e.clientY < r.top + r.height / 2
        ? "before"
        : "after";
  };

  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        const d = current;
        if (!d || !accepts(d)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const edge = edgeOf(e);
        if (edge !== over) setOver(edge);
        if (onHold && hold.current == null)
          hold.current = window.setTimeout(() => {
            if (current) onHold(current);
          }, 550);
      },
      onDragLeave: (e: DragEvent) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return;
        setOver(null);
        clearHold();
      },
      onDrop: (e: DragEvent) => {
        const d = current;
        setOver(null);
        clearHold();
        if (!d || !accepts(d)) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(d, edgeOf(e));
        setCurrent(null);
      },
    },
  };
}
