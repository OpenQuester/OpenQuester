import { useState } from "react";

import { cn } from "@/lib/cn";

/**
 * A text field that looks like a heading and commits on blur or Enter, so a
 * rename is one undo step instead of one per keystroke. Escape reverts.
 */
export function InlineText({
  value,
  onCommit,
  label,
  placeholder,
  className,
  id,
  readOnly,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  id?: string;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // Undo or another edit changed the value: show it.
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      id={id}
      aria-label={label}
      readOnly={readOnly}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className={cn(
        "min-w-0 rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 text-text outline-none placeholder:text-faint",
        !readOnly && "hover:border-line-strong focus:border-info focus:bg-bg",
        className,
      )}
    />
  );
}
