import { createRoot, type Root } from "react-dom/client";
import { GameContext, type GameCommands } from "@/features/game/GameContext";
import { GameStage } from "@/features/game/play/GameStage";
import { GameActionDock } from "@/features/game/play/GameActionDock";
import { PlayerChips } from "@/features/game/play/PlayerChips";
import { HostGameControls } from "@/features/game/play/host/HostGameControls";
import { useHostTools } from "@/features/game/play/host/useHostTools";
import { buildContentPlan } from "@/game/contentPlan";
import { ALICE, SHOWMAN, question, round, session, timer } from "@/game/fixtures";
import { createGameStore, useGameStore } from "@/game/store";

let store = createGameStore();
let root: Root | undefined;
const q = question(100, {
  price: null,
  text: "Final clue starts here",
  textOrder: 0,
  textItems: [{ order: 2, text: "Final second clue" }],
  questionFiles: [
    {
      order: 1,
      displayTime: 2000,
      file: {
        type: "image",
        md5: "synthetic",
        link: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='%23466bb5'/%3E%3C/svg%3E",
      },
    },
  ],
});
const plan = buildContentPlan({
  text: q.text,
  textOrder: q.textOrder,
  textItems: q.textItems,
  files: q.questionFiles,
})!;
function HostControls() {
  return <HostGameControls tools={useHostTools()} />;
}
export function mountFinal(role: "player" | "showman") {
  root?.unmount();
  store = createGameStore();
  const finalRound = round("final");
  finalRound.themes = finalRound.themes.map((theme) => ({
    ...theme,
    questions: theme.questions.map((item) => ({ ...item, price: null })),
  }));
  store.setState({
    connection: "connected",
    session: session({
      currentRound: finalRound,
      questionState: "bidding",
      timer: timer(30_000),
      finalRoundData: {
        phase: "bidding",
        bids: { [ALICE]: 100 },
        answers: [],
        turnOrder: [ALICE],
        eliminatedThemes: [],
      },
    }),
  });
  useGameStore.setState({ connection: "connected", pending: null });
  store.getState().dispatch({
    type: "final-question-data",
    payload: {
      questionData: {
        themeId: 10,
        themeName: "Capitals",
        question: role === "showman" ? { ...q, answerText: "Synthetic answer" } : q,
        contentPlan: plan,
        mediaPreparationId: "0ef90e2e-2d2d-46e6-88d6-5b6453358fd1",
      },
      timer: timer(30_000),
    },
  });
  document.body.innerHTML = "";
  const node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  const emit: GameCommands["emit"] = () => {};
  root.render(
    <GameContext.Provider
      value={{
        store,
        myId: role === "player" ? ALICE : SHOWMAN,
        connection: { connected: true, emit },
      }}
    >
      <div
        className="min-h-screen bg-bg text-text p-3 flex flex-col gap-4"
        data-testid="final-fixture"
      >
        {role === "showman" && <HostControls />}
        <PlayerChips />
        <GameStage />
        <GameActionDock />
      </div>
    </GameContext.Provider>,
  );
}
export function startFinal(timedOut: boolean) {
  const answerTimer = timer(75_000 + plan.totalMs);
  store.getState().dispatch({
    type: "media-download-status",
    payload: {
      playerId: 0,
      mediaDownloaded: true,
      allPlayersReady: true,
      timer: answerTimer,
      contentPlan: plan,
      ...(timedOut ? { timedOut: true } : {}),
    },
  });
  store.getState().dispatch({
    type: "final-phase-complete",
    payload: { phase: "bidding", nextPhase: "answering", timer: answerTimer },
  });
}
