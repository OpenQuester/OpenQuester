import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

import { MoreIcon } from "./icons";
import { useMenu } from "./useMenu";

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
  const { open, setOpen, pos, button, list } = useMenu(items.length);

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
                tabIndex={-1}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  button.current?.focus();
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
