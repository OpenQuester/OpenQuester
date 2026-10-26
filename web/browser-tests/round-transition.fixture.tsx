import { createRoot } from "react-dom/client";

import type { GameConnection } from "../src/game/connection";
import { ALICE, choosing, round, question, timer } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { GameContext } from "../src/features/game/GameContext";
import { GameScreen } from "../src/features/game/play/GameScreen";

export const sent: string[] = [];

/** Mount the real game UI with server events supplied by the browser test. */
export function mountGame(order = 0, reducedMotion = false) {
  document.getElementById("root")!.hidden = true;
  useSettings.getState().update({
    language: "en",
    sound: false,
    reduceMotion: reducedMotion,
    pins: { players: true, chat: true },
  });
  const session = choosing();
  session.state.currentRound = { ...round(), id: order + 1, order };
  useGameStore.setState({
    session,
    gameId: session.gameId,
    connection: "connected",
    pending: null,
  });
  const connection = {
    connected: true,
    emit: (name: string) => sent.push(name),
  } as unknown as GameConnection;
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(
    <GameContext.Provider value={{ connection, myId: ALICE }}>
      <GameScreen />
    </GameContext.Provider>,
  );
}

export function nextRound(name: string) {
  const state = useGameStore.getState().session!.state;
  const order = state.currentRound!.order + 1;
  useGameStore.getState().dispatch({
    type: "next-round",
    payload: { gameState: { ...state, currentRound: { ...round(), id: order + 1, order, name } } },
  });
}

export function showQuestion() {
  useGameStore.getState().dispatch({
    type: "question-data",
    payload: { data: question(), timer: timer(), questionEligiblePlayers: [ALICE] },
  });
  useGameStore.getState().dispatch({
    type: "media-download-status",
    payload: { playerId: ALICE, mediaDownloaded: true, allPlayersReady: true, timer: timer() },
  });
}
