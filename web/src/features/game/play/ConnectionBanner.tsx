import { gameScreenStyles } from "./screen/gameScreenStyles";
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
      <div role="alert" className={gameScreenStyles.offlineBanner}>
        <div className={gameScreenStyles.connectionNotice}>
          <strong>{t("banner.reconnecting")}</strong>
          <span>{t("banner.reconnectingHelp")}</span>
        </div>
      </div>
    );
  }
  if (showPause && session?.state.isPaused) {
    const host = showman(session);
    return (
      <div role="status" className={gameScreenStyles.retryBanner} data-testid="paused-banner">
        <div className={gameScreenStyles.connectionNotice}>
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
