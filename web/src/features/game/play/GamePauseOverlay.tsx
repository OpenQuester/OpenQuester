import { useTranslation } from "react-i18next";

import { PauseIcon } from "@/ui/icons";
import { gameScreenStyles } from "./screen/gameScreenStyles";

import "./GameOverlay.css";

/** Covers only the stage; chat and host management remain reachable. */
export function GamePauseOverlay({ isShowman }: { isShowman: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className="oq-game-overlay-backdrop absolute inset-0 z-10 p-6 text-center text-on-scrim"
      data-testid="pause-overlay"
    >
      <div className={gameScreenStyles.overlayContent}>
        <PauseIcon size={48} />
        <div role="status" aria-live="polite" aria-atomic="true" className="space-y-4">
          <h2 className={gameScreenStyles.overlayTitle}>{t("pause.title")}</h2>
          {!isShowman && <p className="m-0 text-sm text-on-scrim-soft">{t("pause.waiting")}</p>}
        </div>
      </div>
    </div>
  );
}
