import type { InputHTMLAttributes, ReactNode } from "react";

export const mediaControlStyles = {
  label: "flex flex-col gap-2 text-sm",
  range: "min-h-11 w-full",
  iconButton: "w-11 px-0",
  fixedIconButton: "w-11 shrink-0 px-0",
} as const;

/** One completed pointer/keyboard gesture is one editor undo step. */
export function MediaRange({
  label,
  onFinish,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  label: ReactNode;
  onFinish: () => void;
}) {
  return (
    <label className={mediaControlStyles.label}>
      {label}
      <input
        {...input}
        type="range"
        className={mediaControlStyles.range}
        onPointerUp={onFinish}
        onKeyUp={onFinish}
        onBlur={onFinish}
      />
    </label>
  );
}
