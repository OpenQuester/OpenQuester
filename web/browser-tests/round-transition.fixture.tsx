import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";

import { GameConnection } from "../src/game/connection";
import { ALICE, choosing, round, question, timer } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { ConnectedGame } from "../src/features/game/connection/ConnectedGame";

export const sent: string[] = [];

/** Mount the real game UI with server events supplied by the browser test. */
export function mountGame(order: number | null = 0, reducedMotion = false) {
  document.getElementById("root")!.hidden = true;
  useSettings.getState().update({
    language: "en",
    sound: false,
    reduceMotion: reducedMotion,
    pins: { players: true, chat: true },
  });
  const session = choosing();
  session.state.currentRound = order == null ? null : { ...round(), id: order + 1, order };
  if (order == null) session.state.questionState = null;
  useGameStore.setState({
    session,
    gameId: session.gameId,
    connection: "connected",
    pending: null,
    joinError: null,
    left: null,
  });
  GameConnection.prototype.connect = () => useGameStore.getState().setConnection("connected");
  GameConnection.prototype.close = () => useGameStore.getState().setConnection("idle");
  GameConnection.prototype.emit = (name: string, ..._args: unknown[]) => {
    sent.push(name);
  };
  Object.defineProperty(GameConnection.prototype, "connected", { get: () => true });
  const router = createRouter({ routeTree: createRootRoute({ component: FixtureGame }) });
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function FixtureGame() {
  return <ConnectedGame gameId="ABCD" myId={ALICE} join={{ role: "player" }} />;
}

export function startGame() {
  useGameStore
    .getState()
    .dispatch({ type: "start", payload: { currentRound: round(), currentTurnPlayerId: ALICE } });
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
