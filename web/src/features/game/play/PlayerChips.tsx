import { gamePanelStyles } from "./gamePanelStyles";
import { useTranslation } from "react-i18next";
import { phaseOf, seatedPlayers, showman } from "@/game/selectors";
import { Avatar } from "@/ui/Avatar";
import { useSession } from "../GameContext";
import { PlayerChip, ChipName } from "./players/PlayerChip";
import { useFinalContent } from "./useFinalContent";
import { usePointImageReady } from "./question/useQuestionStage";

/** Score bar: every seated player, their score, and what they are doing now. */
export function PlayerChips({ onManage }: { onManage?: (playerId: number) => void }) {
  const { t } = useTranslation();
  const session = useSession();
  const content = useFinalContent(session, phaseOf(session) === "final_answering");
  const pointImageReady = usePointImageReady(session);
  const pointWaiting =
    phaseOf(session) === "all_play_answering" &&
    session.state.currentQuestion?.answerType === "point" &&
    !pointImageReady;
  const host = showman(session);
  const players = seatedPlayers(session);

  return (
    <>
      <ul className={gamePanelStyles.playerChips} aria-label={t("game.scores")}>
        {host && (
          <li className={gamePanelStyles.showmanChip}>
            <Avatar name={host.meta.username} src={host.meta.avatar} size={28} />
            <ChipName name={host.meta.username} />
            <span className="text-xs font-semibold text-accent-strong">{t("roles.showman")}</span>
          </li>
        )}
        {players.map((player) => (
          <PlayerChip
            key={player.meta.id}
            player={player}
            onManage={onManage}
            finalContentPlaying={content.playing}
            pointWaiting={pointWaiting}
          />
        ))}
      </ul>
    </>
  );
}
