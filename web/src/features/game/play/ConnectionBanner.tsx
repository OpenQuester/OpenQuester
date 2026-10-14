import { useTranslation } from "react-i18next";

import { findPlayer, showman } from "@/game/selectors";
import { useGameStore } from "@/game/store";

/** Reconnecting and paused banners. Both say what still works and what does not. */
export function ConnectionBanner({ showPause = false }: { showPause?: boolean }) {
  const { t } = useTranslation();
  const connection = useGameStore((s) => s.connection);
  const session = useGameStore((s) => s.session);

  if (connection === "reconnecting" || connection === "connecting") {
    if (!session) return null;
    return (
      <div
        role="alert"
        className="border-b border-danger/40 bg-danger-surface text-on-danger-surface"
      >
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
          <strong>{t("banner.reconnecting")}</strong>
          <span>{t("banner.reconnectingHelp")}</span>
        </div>
      </div>
    );
  }
  if (showPause && session?.state.isPaused) {
    const host = showman(session);
    return (
      <div
        role="status"
        className="border-b border-warning/30 bg-warning-surface text-on-warning-surface"
        data-testid="paused-banner"
      >
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
          <strong>
            {t("banner.paused", {
              name: host ? findPlayer(session, host.meta.id)?.meta.username : t("roles.showman"),
            })}
          </strong>
          <span>{t("banner.pausedHelp")}</span>
        </div>
      </div>
    );
  }
  return null;
}
