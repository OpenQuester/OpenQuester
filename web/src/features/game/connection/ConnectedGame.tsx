import { useTranslation } from "react-i18next";

import type { JoinOptions } from "@/game/connection";
import { isStarted } from "@/game/reducer";
import { PageLoader } from "@/ui/Spinner";
import { GameContext } from "../GameContext";
import { LobbyScreen } from "../lobby/LobbyScreen";
import { GameScreen } from "../play/GameScreen";
import { GameToasts } from "../play/GameToasts";
import { GameJoinFailure, GameSessionTakeover } from "./ConnectionNotice";
import { useGameConnection } from "./useGameConnection";

export function ConnectedGame({
  gameId,
  myId,
  join,
  onReset,
}: {
  gameId: string;
  myId: number;
  join: JoinOptions;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const { connection, session, joinError, replaced, value } = useGameConnection(gameId, myId, join);
  if (joinError) return <GameJoinFailure joinError={joinError} onReset={onReset} />;
  const takenOver = replaced && <GameSessionTakeover onTakeOver={() => connection.takeOver()} />;
  if (!session) {
    return (
      <>
        <PageLoader label={t("game.joining")} />
        {takenOver}
      </>
    );
  }
  return (
    <GameContext.Provider value={value}>
      {isStarted(session) ? <GameScreen /> : <LobbyScreen />}
      <GameToasts />
      {takenOver}
    </GameContext.Provider>
  );
}
