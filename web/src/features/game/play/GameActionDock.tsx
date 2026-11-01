import { actionDockStyles } from "./dock/actionDockStyles";
import { useTranslation } from "react-i18next";
import { TimerRing } from "@/ui/TimerRing";
import { DockAction, DockInfo } from "./dock/DockAction";
import { useDockPresentation } from "./dock/useDockPresentation";
import { useGame, useSession } from "../GameContext";
import { PlayerMessage } from "./PlayerName";
import { myRole } from "@/game/selectors";
import "./dock/ActionDock.css";

/** Phase, role-specific action and next step, with the current timer. */
export function GameActionDock() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const {
    model,
    phase,
    paused,
    offline,
    fraction,
    left,
    ringLabel,
    ringColor,
    isShowman,
    opening,
  } = useDockPresentation();

  return (
    <div
      role="region"
      aria-label={t("dock.region")}
      className={actionDockStyles.root}
      data-testid="dock"
      data-role={myRole(session, myId)}
      data-phase={phase}
    >
      <div className={actionDockStyles.content}>
        <div className={actionDockStyles.statusGroup}>
          <TimerRing
            fraction={paused || offline ? null : fraction}
            leftMs={left}
            label={ringLabel}
            color={ringColor}
            size={40}
          />
          <div className="game-dock-status-copy flex min-w-0 flex-col">
            <span className={actionDockStyles.phase} data-testid="dock-phase">
              {offline ? t("dock.reconnecting") : paused ? t("dock.paused") : t(`phases.${phase}`)}
            </span>
            <span className={actionDockStyles.status} data-testid="dock-status">
              {model.statusPlayer ? (
                <PlayerMessage
                  i18nKey={model.statusPlayer.key}
                  name={model.statusPlayer.name}
                  values={model.statusPlayer.values}
                />
              ) : (
                model.status
              )}
            </span>
          </div>
          {model.next && (
            <details className={actionDockStyles.compactNextStep} data-no-shortcuts>
              <summary aria-label={t("dock.next")}>?</summary>
              <p>{model.next}</p>
            </details>
          )}
        </div>
        <div className={actionDockStyles.action}>
          {offline ? (
            <DockInfo>{t("dock.offlineInfo")}</DockInfo>
          ) : paused && !isShowman ? (
            <DockInfo>{t("pause.waiting")}</DockInfo>
          ) : null}
          <fieldset
            disabled={paused || offline || opening}
            hidden={paused || offline}
            className="m-0 min-w-0 w-full border-0 p-0"
          >
            <DockAction
              key={`${myId}:${session.gameId}:${session.state.currentRound?.id}:${session.state.currentQuestion?.id}:${session.state.answeringPlayer}:${model.action?.kind}`}
              action={model.action}
            />
          </fieldset>
        </div>
        {model.next && (
          <p className={actionDockStyles.desktopNextStep}>
            <span className="font-semibold text-text">{t("dock.next")}</span>
            <span>{model.next}</span>
          </p>
        )}
      </div>
    </div>
  );
}
