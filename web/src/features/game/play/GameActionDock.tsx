import { actionDockStyles } from "./dock/actionDockStyles";
import { useTranslation } from "react-i18next";
import { TimerRing } from "@/ui/TimerRing";
import { DockAction, DockInfo } from "./dock/DockAction";
import { useDockPresentation } from "./dock/useDockPresentation";
import { useSession } from "../GameContext";

/** Phase, role-specific action and next step, with the current timer. */
export function GameActionDock() {
  const { t } = useTranslation();
  const session = useSession();
  const { model, phase, paused, offline, fraction, left, ringLabel, ringColor } =
    useDockPresentation();

  return (
    <div
      role="region"
      aria-label={t("dock.region")}
      className={actionDockStyles.root}
      data-testid="dock"
    >
      <div className={actionDockStyles.content}>
        <div className={actionDockStyles.statusGroup}>
          <TimerRing
            fraction={paused || offline ? null : fraction}
            leftMs={left}
            label={ringLabel}
            color={ringColor}
            size={52}
          />
          <div className="flex min-w-0 flex-col">
            <span className={actionDockStyles.phase} data-testid="dock-phase">
              {offline ? t("dock.reconnecting") : paused ? t("dock.paused") : t(`phases.${phase}`)}
            </span>
            <span className={actionDockStyles.status} data-testid="dock-status">
              {model.status}
            </span>
          </div>
        </div>
        <div className={actionDockStyles.action}>
          {offline ? (
            <DockInfo>{t("dock.offlineInfo")}</DockInfo>
          ) : paused ? (
            <DockInfo>{t("dock.pausedInfo")}</DockInfo>
          ) : null}
          <fieldset
            disabled={paused || offline}
            hidden={paused || offline}
            className="m-0 min-w-0 w-full border-0 p-0"
          >
            <DockAction
              key={`${session.gameId}:${session.state.currentRound?.id}:${session.state.currentQuestion?.id}:${session.state.answeringPlayer}:${model.action?.kind}`}
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
        {model.next && <p className={actionDockStyles.compactNextStep}>{model.next}</p>}
      </div>
    </div>
  );
}
