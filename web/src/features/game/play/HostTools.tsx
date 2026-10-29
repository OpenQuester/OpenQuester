import { gamePanelStyles } from "./gamePanelStyles";
import { useTranslation } from "react-i18next";
import type { GameJoinMode } from "@/game/protocol";
import { Label, Select } from "@/ui/Field";
import { DeleteGameButton } from "../DeleteGameButton";
import { PlayersBody } from "./PlayersPanel";
import { HostGameControls } from "./host/HostGameControls";
import { HostGameInfo } from "./host/HostGameInfo";
import { HostGameRules } from "./host/HostGameRules";
import { useHostTools } from "./host/useHostTools";
/** Showman tools keep the player-management form mounted across control updates. */
export function HostTools({
  focusPlayer,
  onBoardEdit,
}: {
  focusPlayer?: number | null;
  /** Called when board editing starts; a sheet closes so the board is reachable. */
  onBoardEdit?: () => void;
}) {
  const { t } = useTranslation();
  const tools = useHostTools();
  const { session, connection, phase } = tools;
  return (
    <div className="flex flex-col" data-testid="host-panel">
      {phase !== "finished" && <HostGameControls tools={tools} onBoardEdit={onBoardEdit} />}
      {phase !== "finished" && (
        <section className={gamePanelStyles.hostPlayers}>
          <Label htmlFor="join-mode">{t("menu.joinMode")}</Label>
          <Select
            id="join-mode"
            value={session.state.joinMode ?? "open"}
            onChange={(e) =>
              connection.emit("game-join-mode-change", { joinMode: e.target.value as GameJoinMode })
            }
          >
            {(["open", "spectators_only", "closed"] as const).map((m) => (
              <option key={m} value={m}>
                {t(`menu.joinModes.${m}`)}
              </option>
            ))}
          </Select>
        </section>
      )}
      {phase !== "finished" && <HostGameRules />}
      {phase !== "finished" && <HostGameInfo />}
      <PlayersBody compact focusPlayer={focusPlayer} key={focusPlayer ?? "none"} />
      <section className={gamePanelStyles.hostRound}>
        <p className="m-0 text-sm text-muted">{t("menu.hostHelp")}</p>
        <DeleteGameButton gameId={session.gameId} />
      </section>
    </div>
  );
}
