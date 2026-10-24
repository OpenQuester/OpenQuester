import { gameScreenStyles } from "./screen/gameScreenStyles";
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
export function GameSidePanel({
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
      className={cn(gameScreenStyles.panel, className)}
      data-testid={`panel-${id}`}
      data-pinned={pinned}
    >
      <div className={gameScreenStyles.panelHeader}>
        <h2 className={gameScreenStyles.panelTitle}>{title}</h2>
        <button
          type="button"
          onClick={onPin}
          aria-pressed={pinned}
          aria-label={
            pinned ? t("panels.unpin", { name: title }) : t("panels.pin", { name: title })
          }
          title={pinned ? t("panels.unpinHelp") : t("panels.pinHelp")}
          className={cn(
            gameScreenStyles.panelButton,
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
          className={gameScreenStyles.panelCloseButton}
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
