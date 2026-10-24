import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

import { MoreIcon } from "./icons";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * A "more actions" button with a small popup list. Rendered in a portal so a
 * scrolling board doesn't clip it; arrow keys move between items.
 */
export function Menu({
  label,
  items,
  className,
  size = 36,
}: {
  label: string;
  items: MenuItem[];
  className?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 220;
    const height = items.length * 44 + 12;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const below = r.bottom + 4 + height < window.innerHeight;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height), left });
  }, [open, items.length]);

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
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const all = [
          ...(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        const i = all.indexOf(document.activeElement as HTMLButtonElement);
        all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
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

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-3 hover:text-text",
          className,
        )}
      >
        <MoreIcon size={18} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[70] flex w-[220px] flex-col rounded-md border border-line-strong bg-surface-2 p-1.5 shadow-2xl oq-pop"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-sm px-3 text-left text-[15px] font-medium disabled:cursor-not-allowed disabled:text-faint",
                  item.danger
                    ? "text-danger hover:bg-danger-surface"
                    : "text-text hover:bg-surface-3",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
