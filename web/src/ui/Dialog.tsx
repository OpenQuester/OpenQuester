import * as RD from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { useRef, type ReactNode } from "react";

import { CloseIcon } from "./icons";
import { dialogStyles } from "./dialogStyles";

/** Centered dialog on wide screens, bottom sheet on phones. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "center",
  closeLabel = "Close",
  wide = false,
  fullScreen = false,
  restoreFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: "center" | "right";
  closeLabel?: string;
  wide?: boolean;
  fullScreen?: boolean;
  restoreFocus?: () => HTMLElement | null;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className={dialogStyles.overlay} />
        <RD.Content
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = restoreFocus?.();
            if (target?.isConnected) target.focus();
            else if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
          }}
          className={cn(
            dialogStyles.standardSurface,
            side === "center" &&
              "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
            side === "right" &&
              "inset-x-0 bottom-0 h-[85dvh] rounded-t-lg sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[380px] sm:rounded-none sm:rounded-l-lg",
            wide &&
              "h-[90dvh] sm:h-[min(860px,calc(100dvh-48px))] sm:w-[min(1120px,calc(100vw-48px))]",
            fullScreen &&
              "h-[96dvh] max-h-[96dvh] sm:h-[calc(100dvh-32px)] sm:max-h-[calc(100dvh-32px)] sm:w-[calc(100vw-32px)]",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 border-b border-line px-5",
              fullScreen ? "py-1" : "py-4",
            )}
          >
            <RD.Title
              className={cn(
                "m-0 flex-1 font-display font-extrabold",
                fullScreen ? "text-base" : "text-xl",
              )}
            >
              {title}
            </RD.Title>
            <RD.Close aria-label={closeLabel} className={dialogStyles.standardCloseButton}>
              <CloseIcon size={18} />
            </RD.Close>
          </div>
          {description ? (
            <RD.Description className="sr-only">{description}</RD.Description>
          ) : (
            <RD.Description className="sr-only">{title}</RD.Description>
          )}
          <div className={cn("min-h-0 flex-1 overflow-y-auto", wide && "flex flex-col")}>
            {children}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
