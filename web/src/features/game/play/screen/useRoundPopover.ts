import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ToggleEvent,
} from "react";

/** Native top-layer dismissal, with hover preview and click-to-pin for the round list. */
export function useRoundPopover() {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinned = useRef(false);
  const restoringFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const clearTimer = () => clearTimeout(timer.current);
  const hide = () => {
    clearTimer();
    pinned.current = false;
    // Native dismissal can synchronously restore focus to the trigger.
    restoringFocus.current = true;
    panel.current?.hidePopover();
    restoringFocus.current = false;
  };
  const show = () => {
    clearTimer();
    const popup = panel.current,
      button = trigger.current;
    if (!popup || !button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(390, window.innerWidth - 24);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 92);
    popup.style.width = `${width}px`;
    popup.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    popup.style.top = `${top}px`;
    popup.style.maxHeight = `${Math.min(540, window.innerHeight - top - 12)}px`;
    if (popup.matches(":popover-open")) return;
    popup.showPopover();
    const list = popup.querySelector("ol"),
      active = popup.querySelector<HTMLElement>("[aria-current]");
    if (list && active)
      list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const resize = () => panel.current?.hidePopover();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [open]);
  return {
    trigger,
    panel,
    open,
    enter: (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      clearTimer();
      timer.current = setTimeout(show, 110);
    },
    keepOpen: clearTimer,
    leave: () => {
      clearTimer();
      timer.current = setTimeout(() => {
        if (
          !pinned.current &&
          document.activeElement !== trigger.current &&
          !panel.current?.contains(document.activeElement)
        )
          hide();
      }, 150);
    },
    focus: () => {
      if (!restoringFocus.current) show();
    },
    click: (event: MouseEvent) => {
      event.preventDefault();
      if (pinned.current) hide();
      else {
        pinned.current = true;
        show();
      }
    },
    blur: (event: FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget)) hide();
    },
    toggle: (event: ToggleEvent<HTMLElement>) => {
      const isOpen = event.newState === "open";
      setOpen(isOpen);
      if (!isOpen) {
        clearTimer();
        pinned.current = false;
      }
    },
    keyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" && event.target === trigger.current) {
        event.preventDefault();
        show();
        panel.current?.querySelector("ol")?.focus({ preventScroll: true });
      } else if (event.key === "Escape" && panel.current?.matches(":popover-open")) {
        event.preventDefault();
        hide();
        restoringFocus.current = true;
        trigger.current?.focus({ preventScroll: true });
        restoringFocus.current = false;
      }
    },
  };
}
