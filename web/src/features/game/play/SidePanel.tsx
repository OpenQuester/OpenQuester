import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { PanelId } from "@/features/settings/settingsStore";
import { cn } from "@/lib/cn";
import { CloseIcon, PinIcon } from "@/ui/icons";

/**
 * Wide enough to keep panels next to the game instead of over it. Below this
 * (phones, tablets in portrait) panels open as sheets.
 */
export const WIDE_QUERY = "(min-width: 1024px)";

/**
 * A panel docked in the right-hand column on wide screens. It never covers the
 * game, so the showman can manage players or read chat while watching the
 * board. Pinned panels stay open, also after a reload, on this device.
 */
export function SidePanel({
  id,
  title,
  pinned,
  onPin,
  onClose,
  className,
  children,
}: {
  id: PanelId;
  title: string;
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={title}
      className={cn("flex min-h-0 flex-col border-b border-line last:border-b-0", className)}
      data-testid={`panel-${id}`}
      data-pinned={pinned}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="m-0 flex-1 truncate font-display text-lg font-extrabold">{title}</h2>
        <button
          type="button"
          onClick={onPin}
          aria-pressed={pinned}
          aria-label={
            pinned ? t("panels.unpin", { name: title }) : t("panels.pin", { name: title })
          }
          title={pinned ? t("panels.unpinHelp") : t("panels.pinHelp")}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-sm border",
            pinned
              ? "border-accent-line bg-accent-surface text-accent-strong"
              : "border-line-strong text-muted hover:bg-surface-2 hover:text-text",
          )}
          data-testid={`pin-${id}`}
        >
          <PinIcon size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("panels.close", { name: title })}
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line-strong text-text hover:bg-surface-2"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
