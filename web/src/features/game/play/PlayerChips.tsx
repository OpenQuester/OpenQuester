import { gamePanelStyles } from "./gamePanelStyles";
import { useTranslation } from "react-i18next";
import { phaseOf, seatedPlayers, showman } from "@/game/selectors";
import { useSession } from "../GameContext";
import { PlayerChip } from "./players/PlayerChip";
import { PlayerCard } from "./players/PlayerCard";
import { useFinalContent } from "./useFinalContent";
import { usePointImageReady } from "./question/useQuestionStage";
import { useQuestionOutcomes } from "./players/useQuestionOutcomes";

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
  const outcomes = useQuestionOutcomes();

  return (
    <>
      <ul className={gamePanelStyles.playerChips} aria-label={t("game.scores")}>
        {host && (
          <li>
            <PlayerCard player={host} />
          </li>
        )}
        {players.map((player) => (
          <PlayerChip
            key={player.meta.id}
            player={player}
            onManage={onManage}
            finalContentPlaying={content.playing}
            pointWaiting={pointWaiting}
            outcome={outcomes[player.meta.id]}
          />
        ))}
      </ul>
    </>
  );
}
