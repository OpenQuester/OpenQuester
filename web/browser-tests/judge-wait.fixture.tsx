import { createRoot, type Root } from "react-dom/client";
import { GameContext, type GameCommands } from "@/features/game/GameContext";
import { GameActionDock } from "@/features/game/play/GameActionDock";
import { ShowmanPanel } from "@/features/game/play/question/ShowmanPanel";
import { onPlaytestKey } from "@/features/package-editor/playtest/playtestKeyboard";
import type { PreviewRuntime } from "@/features/package-editor/playtest/previewRuntime";
import { BOB, question, round, session, SHOWMAN, timer } from "@/game/fixtures";
import { createGameStore } from "@/game/store";

let store = createGameStore();
let root: Root;
const emitted: { name: string; payload: unknown }[] = [];

export function mountJudge(kind: "number" | "point" | "choice") {
  store = createGameStore();
  emitted.length = 0;
  const q = kind === "choice" ? { type: "choice" as const } : { answerType: kind };
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      currentQuestion: question(100, q),
      questionState: "answering",
      answeringPlayer: BOB,
      timer: timer(),
    }),
  });
  document.body.innerHTML = "";
  const node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  const emit: GameCommands["emit"] = (name, ...args) => {
    emitted.push({ name, payload: args[0] });
  };
  const connection = { connected: true, emit };
  const game = {
    get session() {
      return store.getState().session!;
    },
    commands: connection,
  } as PreviewRuntime;
  root.render(
    <GameContext.Provider value={{ store, myId: SHOWMAN, connection }}>
      <div
        className="min-h-screen bg-bg p-4 text-text"
        tabIndex={0}
        data-testid="judge-fixture"
        onKeyDown={(event) => onPlaytestKey(event, game, SHOWMAN)}
      >
        <ShowmanPanel />
        <GameActionDock />
      </div>
    </GameContext.Provider>,
  );
}
export function submitUnrecognized() {
  store.getState().dispatch({ type: "answer-submitted", payload: { answerText: "unrecognized" } });
}
export function actions() {
  return emitted;
}
