import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Hover/focus and touch disclosure without moving the score bar. */
export function usePlayerCard() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: "calc(100dvh - 16px)" });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => {
    if (document.querySelector("[data-avatar-dialog]")) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const leave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (document.querySelector("[data-avatar-dialog]")) return;
      if (
        !panel.current?.matches(":hover") &&
        !trigger.current?.matches(":hover") &&
        !panel.current?.contains(document.activeElement) &&
        document.activeElement !== trigger.current
      )
        setOpen(false);
    }, 180);
  };
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const button = trigger.current.getBoundingClientRect();
    const popup = panel.current.getBoundingClientRect();
    const top = button.bottom + 8;
    setPosition({
      left: Math.max(8, Math.min(button.left, window.innerWidth - popup.width - 8)),
      top,
      maxHeight: `${Math.max(0, window.innerHeight - top - 8)}px`,
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (document.querySelector("[data-avatar-dialog]")) return;
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        event.key === "Escape" &&
        !document.querySelector("[data-avatar-dialog]")
      ) {
        event.preventDefault();
        trigger.current?.focus({ preventScroll: true });
        setOpen(false);
      }
    };
    const resize = () => setOpen(false);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  const focusPanel = () => {
    keepOpen();
    requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(),
    );
  };
  return { open, setOpen, position, trigger, panel, keepOpen, leave, focusPanel };
}
