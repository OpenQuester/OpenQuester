import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { onChoiceKeyDown } from "./choiceNavigation";

/** A selectable button inside a labeled radio group. */
export function RadioButton({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      onKeyDown={onChoiceKeyDown}
      onClick={onClick}
      className={cn(
        "min-h-12 flex-1 rounded-[12px] px-3 text-[15px] font-semibold text-text",
        checked ? "border-2 border-accent bg-accent-surface" : "border border-line-strong",
      )}
    >
      {children}
    </button>
  );
}
