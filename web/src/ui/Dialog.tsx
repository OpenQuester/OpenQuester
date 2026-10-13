import * as RD from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

import { CloseIcon } from "./icons";

/** Centered dialog on wide screens, bottom sheet on phones. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "center",
  closeLabel = "Close",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: "center" | "right";
  closeLabel?: string;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-[#05060d]/70 oq-pop" />
        <RD.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface text-text border border-line-strong shadow-2xl outline-none oq-slide-up",
            side === "center" &&
              "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
            side === "right" &&
              "inset-x-0 bottom-0 h-[85dvh] rounded-t-lg sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[380px] sm:rounded-none sm:rounded-l-lg",
          )}
        >
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <RD.Title className="m-0 flex-1 font-display text-xl font-extrabold">{title}</RD.Title>
            <RD.Close
              aria-label={closeLabel}
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-line-strong text-text hover:bg-surface-2"
            >
              <CloseIcon size={18} />
            </RD.Close>
          </div>
          {description ? (
            <RD.Description className="sr-only">{description}</RD.Description>
          ) : (
            <RD.Description className="sr-only">{title}</RD.Description>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
