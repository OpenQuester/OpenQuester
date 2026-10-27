import { gameScreenStyles } from "./screen/gameScreenStyles";
import { useTranslation } from "react-i18next";

import { useGameStore } from "@/game/store";

/** Connection feedback stays visible above the game and its pause overlay. */
export function ConnectionBanner() {
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
  return null;
}
