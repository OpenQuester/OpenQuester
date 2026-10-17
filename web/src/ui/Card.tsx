import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({
  className,
  tone = "surface",
  ...rest
}: HTMLAttributes<HTMLElement> & { tone?: "surface" | "raised" | "accent" }) {
  return (
    <section
      className={cn(
        "rounded-lg border p-5 sm:p-6",
        tone === "surface" && "bg-surface border-line",
        tone === "raised" && "bg-surface-2 border-line-strong",
        tone === "accent" && "bg-accent-surface border-accent-line",
        className,
      )}
      {...rest}
    />
  );
}
