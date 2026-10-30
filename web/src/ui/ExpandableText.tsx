import { useId, useRef, type SyntheticEvent } from "react";
import { cn } from "@/lib/cn";

/** Ellipsis with the complete text on hover, focus or tap; the top layer escapes scrolling lists. */
export function ExpandableText({ text, className }: { text: string; className?: string }) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const position = (event: SyntheticEvent<HTMLButtonElement>) => {
    const panel = popup.current;
    if (!panel) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(480, window.innerWidth - 24);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    panel.style.top = `${Math.max(12, Math.min(rect.bottom, window.innerHeight * 0.6 - 12))}px`;
  };
  const show = (event: SyntheticEvent<HTMLButtonElement>) => {
    position(event);
    popup.current?.showPopover?.();
  };
  const leave = (event: SyntheticEvent<HTMLElement, FocusEvent | PointerEvent>) => {
    const next = event.nativeEvent.relatedTarget as Node | null;
    if (popup.current?.contains(next) || trigger.current?.contains(next)) return;
    if (event.type === "pointerleave" && document.activeElement === trigger.current) return;
    popup.current?.hidePopover?.();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        onPointerEnter={show}
        onFocus={show}
        onClick={(event) => {
          event.preventDefault();
          show(event);
        }}
        onPointerLeave={leave}
        onBlur={leave}
        className={cn("block min-w-0 max-w-full truncate text-left", className)}
      >
        {text}
      </button>
      <div
        ref={popup}
        id={id}
        popover="auto"
        onPointerLeave={leave}
        className="fixed inset-auto m-0 max-h-[40dvh] overflow-y-auto whitespace-pre-wrap rounded-md border border-line-strong bg-surface-2 p-4 text-left text-base font-medium text-text shadow-2xl [overflow-wrap:anywhere]"
      >
        {text}
      </div>
    </>
  );
}
