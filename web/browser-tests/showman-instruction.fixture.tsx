import { createRoot } from "react-dom/client";
import { GameConnection } from "../src/game/connection";
import { question, round, session } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { GameContext } from "../src/features/game/GameContext";
import { QuestionStage } from "../src/features/game/play/QuestionStage";
import { FinalAnswerStage } from "../src/features/game/play/FinalStages";

export function mountInstruction(myId: number, final: boolean) {
  document.getElementById("root")!.hidden = true;
  const game = session({
    currentRound: round(final ? "final" : "simple"),
    questionState: "showing",
    currentQuestion: question(100, {
      text: "A long question ".repeat(250),
      questionComment: "Read this first",
    }),
  });
  useGameStore.setState({ session: game, connection: "connected", pending: null });
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(
    <GameContext.Provider
      value={{ connection: new GameConnection("ABCD", myId, { role: "player" }), myId }}
    >
      {final ? <FinalAnswerStage /> : <QuestionStage />}
    </GameContext.Provider>,
  );
}
