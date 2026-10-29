import {
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { QuestionStep } from "./questionTimeline";
import { stepId } from "./timelineMove";

type MovableStep = Exclude<QuestionStep, { kind: "main" }>;
type Edge = "before" | "after";
type Insertion = { id: string; edge: Edge; vertical: boolean };

function edgeAt(card: HTMLElement, x: number, y: number): Omit<Insertion, "id"> {
  const rect = card.getBoundingClientRect();
  const parent = card.parentElement?.getBoundingClientRect();
  const vertical = !!parent && rect.width > parent.width * 0.8;
  const before = vertical ? y < rect.top + rect.height / 2 : x < rect.left + rect.width / 2;
  return { vertical, edge: before ? "before" : "after" };
}

function touchTarget(handle: HTMLElement, x: number, y: number): HTMLElement | null {
  const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-timeline-card]");
  return card && handle.closest('[data-testid="attachment-drop-zone"]')?.contains(card)
    ? card
    : null;
}

/** One attachment list's native, touch and keyboard reorder interactions. */
export function useAttachmentReorder(
  steps: readonly MovableStep[],
  move: (id: string, destination: number) => void,
  firstPosition: number,
) {
  const { t } = useTranslation();
  const helpId = useId();
  const dragged = useRef<string | null>(null);
  const dragCard = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [insertion, setInsertion] = useState<Insertion | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const clear = () => {
    const card = dragCard.current;
    dragCard.current = null;
    window.setTimeout(() => {
      if (dragCard.current !== card) card?.removeAttribute("data-timeline-dragging");
    }, 0);
    dragged.current = null;
    setDragging(null);
    setInsertion(null);
  };
  const dropAt = (source: string, target: string, edge: Edge) => {
    const from = steps.findIndex((step) => stepId(step) === source);
    const index = steps.findIndex((step) => stepId(step) === target);
    if (from < 0 || index < 0) return;
    const at = index + (edge === "after" ? 1 : 0);
    move(source, at - (from < at ? 1 : 0));
  };
  const begin = (id: string, handle: HTMLElement) => {
    dragged.current = id;
    dragCard.current = handle.closest<HTMLElement>("[data-timeline-card]");
    dragCard.current?.setAttribute("data-timeline-dragging", "true");
  };
  const grip = (id: string, index: number) => ({
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const offset =
        event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : 0;
      if (!offset) return;
      event.preventDefault();
      event.stopPropagation();
      const destination = index + offset;
      if (destination < 0 || destination >= steps.length) return;
      move(id, destination);
      setAnnouncement(t("editor.timeline.moveStatus", { number: destination + firstPosition }));
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "touch") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      begin(id, event.currentTarget);
      setDragging(id);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "touch" || dragged.current !== id) return;
      const card = touchTarget(event.currentTarget, event.clientX, event.clientY);
      const target = card?.dataset.timelineId;
      if (!card || !target) {
        setInsertion(null);
        return;
      }
      setInsertion({ id: target, ...edgeAt(card, event.clientX, event.clientY) });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "touch" || dragged.current !== id) return;
      const card = touchTarget(event.currentTarget, event.clientX, event.clientY);
      if (card?.dataset.timelineId)
        dropAt(id, card.dataset.timelineId, edgeAt(card, event.clientX, event.clientY).edge);
      clear();
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "touch") clear();
    },
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      begin(id, event.currentTarget);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      if (dragCard.current) event.dataTransfer.setDragImage(dragCard.current, 20, 20);
      event.stopPropagation();
      window.setTimeout(() => {
        if (dragged.current === id) setDragging(id);
      }, 0);
    },
    onDragEnd: clear,
  });
  const card = (id: string) => ({
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!dragged.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const { edge, vertical } = edgeAt(event.currentTarget, event.clientX, event.clientY);
      setInsertion((prev) =>
        prev?.id === id && prev.edge === edge && prev.vertical === vertical
          ? prev
          : { id, edge, vertical },
      );
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInsertion(null);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      const source = dragged.current;
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();
      dropAt(source, id, edgeAt(event.currentTarget, event.clientX, event.clientY).edge);
      clear();
    },
  });
  return { helpId, announcement, dragging, insertion, grip, card };
}
