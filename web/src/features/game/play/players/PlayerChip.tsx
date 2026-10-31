import { useTranslation } from "react-i18next";
import type { Player } from "@/game/protocol";
import { useSession } from "../../GameContext";
import { chipState } from "./chipState";
import { PlayerCard } from "./PlayerCard";
import type { AnswerOutcome } from "@/game/questionFeedback";

export function PlayerChip({
  player,
  onManage,
  finalContentPlaying = false,
  pointWaiting = false,
  outcome,
}: {
  player: Player;
  onManage?: (playerId: number) => void;
  finalContentPlaying?: boolean;
  pointWaiting?: boolean;
  outcome?: AnswerOutcome;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const chip = chipState(session, player, t, finalContentPlaying, pointWaiting);
  return (
    <li data-testid="player-chip" data-player={player.meta.username}>
      <PlayerCard player={player} {...chip} outcome={outcome} onManage={onManage} />
    </li>
  );
}
