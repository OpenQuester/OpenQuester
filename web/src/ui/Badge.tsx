import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "accent" | "info" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  accent: "bg-accent-surface text-accent-strong",
  info: "bg-surface-2 text-info-soft",
  neutral: "bg-surface-2 text-muted",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-[13px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
