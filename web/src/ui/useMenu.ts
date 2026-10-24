import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Position, focus and dismiss one portalled menu for its mounted trigger. */
export function useMenu(itemCount: number) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 220;
    const height = itemCount * 44 + 12;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const below = r.bottom + 4 + height < window.innerHeight;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height), left });
  }, [open, itemCount]);

  // The list mounts only once it has a position, so focus it after that
  useEffect(() => {
    if (!open || !pos) return;
    list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (list.current?.contains(e.target as Node) || button.current?.contains(e.target as Node))
        return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (!list.current?.contains(e.target as Node) && e.target !== button.current) return;
      if (e.key === "Tab") {
        setOpen(false);
        button.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const all = [
          ...(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        const i = all.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? all.length - 1
              : (i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length;
        all[next]?.focus();
      }
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  return { open, setOpen, pos, button, list };
}
