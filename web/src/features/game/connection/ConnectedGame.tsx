import { useTranslation } from "react-i18next";

import type { JoinOptions } from "@/game/connection";
import { isStarted } from "@/game/reducer";
import { PageLoader } from "@/ui/Spinner";
import { GameContext } from "../GameContext";
import { LobbyScreen } from "../lobby/LobbyScreen";
import { GameScreen } from "../play/GameScreen";
import { GameToasts } from "../play/GameToasts";
import { RoundTransition } from "../play/RoundTransition";
import { GameSessionTakeover } from "./ConnectionNotice";
import { useGameConnection } from "./useGameConnection";

export function ConnectedGame({
  gameId,
  myId,
  join,
  showLoader = true,
}: {
  gameId: string;
  myId: number;
  join: JoinOptions;
  showLoader?: boolean;
}) {
  const { t } = useTranslation();
  const { connection, session, joinError, replaced, value } = useGameConnection(gameId, myId, join);
  if (joinError) return null;
  const takenOver = replaced && <GameSessionTakeover onTakeOver={() => connection.takeOver()} />;
  if (!session) {
    return (
      <>
        {showLoader && <PageLoader label={t("game.joining")} />}
        {takenOver}
      </>
    );
  }
  return (
    <GameContext.Provider value={value}>
      {isStarted(session) ? <GameScreen /> : <LobbyScreen />}
      <RoundTransition round={session.state.currentRound} />
      <GameToasts />
      {takenOver}
    </GameContext.Provider>
  );
}
