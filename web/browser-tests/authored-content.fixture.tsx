import { createRoot } from "react-dom/client";
import { GameContext } from "../src/features/game/GameContext";
import { QuestionStage } from "../src/features/game/play/QuestionStage";
import { question, session, round, ALICE } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { buildContentPlan, buildAnswerContentPlan } from "../src/game/contentPlan";
import { publicQuestion } from "../src/features/package-editor/playtest/previewModel";
import { useSettings } from "../src/features/settings/settingsStore";
import type { PlayerRole } from "../src/game/protocol";

export function mount(role: PlayerRole, reveal = false, elapsed = 1500) {
  document.getElementById("root")!.hidden = true;
  useSettings.getState().update({ language: "en", sound: false, volume: 0, reduceMotion: true });
  const q = question(100, {
    text: "Public first screen",
    textOrder: 0,
    textDurationMs: 1000,
    textItems: [
      { order: 1, text: "Private spoken secret", placement: "replic", durationMs: 3000 },
      { order: 2, text: "", placement: "screen", durationMs: 1000 },
    ],
    answerText: "Paris",
    answerDurationMs: 15000,
    showmanComments: "Private instruction",
    answerTextItems: [
      { order: 0, text: "Before answer image", durationMs: 2000 },
      { order: 2, text: "After answer image", durationMs: 2000 },
    ],
    questionFiles: [],
    answerFiles: [
      {
        order: 1,
        displayTime: 1000,
        file: {
          type: "image",
          md5: "answer",
          link: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='50'%3E%3Crect width='80' height='50' fill='gold'/%3E%3C/svg%3E",
        },
      },
    ],
  });
  const game = session({
    currentRound: round(),
    questionState: reveal ? "showing_answer" : "showing",
    currentQuestion: role === "showman" ? q : publicQuestion(q),
    timer: null,
    isPaused: false,
    answerShowData: reveal
      ? {
          answerText: q.answerText!,
          answerFiles: q.answerFiles!,
          answerTextItems: q.answerTextItems,
          answerExplanation: "Revealed explanation",
          nextTurnPlayerId: null,
        }
      : null,
  });
  game.players = game.players.map((p) =>
    p.meta.id === ALICE
      ? { ...p, role }
      : role === "showman" && p.role === "showman"
        ? { ...p, role: "spectator" }
        : p,
  );
  const plan = reveal
    ? buildAnswerContentPlan({ files: q.answerFiles, textItems: q.answerTextItems })!
    : buildContentPlan({ ...q, files: q.questionFiles })!;
  game.content = { kind: reveal ? "answer" : "question", plan, timer: null, frozenAtMs: elapsed };
  useGameStore.setState({ session: game, connection: "connected", pending: null });
  const container = document.createElement("div");
  container.className = "game-screen flex min-h-dvh min-w-0 flex-col p-3";
  document.body.append(container);
  createRoot(container).render(
    <GameContext.Provider
      value={{ myId: ALICE, connection: { connected: true, emit: () => {} }, store: useGameStore }}
    >
      <QuestionStage />
    </GameContext.Provider>,
  );
}
