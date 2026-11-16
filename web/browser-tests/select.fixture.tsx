import { createRoot, type Root } from "react-dom/client";
import { GameContext, type GameCommands } from "@/features/game/GameContext";
import { GameStage } from "@/features/game/play/GameStage";
import { GameActionDock } from "@/features/game/play/GameActionDock";
import { ALICE, question, round, session, timer } from "@/game/fixtures";
import { createGameStore } from "@/game/store";

let root: Root | undefined;
let store = createGameStore();
const commands: { event: string; payload: unknown }[] = [];

function audio(): string {
  const bytes = new Uint8Array(44 + 1600);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) =>
    [...value].forEach((char, index) => {
      bytes[at + index] = char.charCodeAt(0);
    });
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, 1600, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

export function mountSelect(final: boolean, media: boolean | "video" = false) {
  root?.unmount();
  store = createGameStore();
  commands.length = 0;
  const q = question(100, {
    answerType: "select",
    showDelay: 0,
    text: "Choose an option",
    answers: Array.from({ length: media ? 9 : 30 }, (_, order) => ({
      order,
      sourceLabel: `L${order}`,
      text: `Option ${order + 1}`,
      file: media
        ? media === "video"
          ? { md5: "video", type: "video" as const, link: "/e2e/fixtures/clip.webm" }
          : { md5: "audio", type: "audio" as const, link: audio() }
        : null,
    })),
  });
  const initial = session({
    currentRound: round(final ? "final" : "simple"),
    questionState: final ? "answering" : "showing",
    currentQuestion: final ? null : q,
    ...(final
      ? {
          finalRoundData: {
            phase: "answering" as const,
            turnOrder: [ALICE],
            submittedBidPlayerIds: [ALICE],
            bids: { [ALICE]: 100 },
            answers: [],
            eliminatedThemes: [],
            questionData: { themeId: 10, themeName: "T", question: q },
          },
        }
      : {
          allPlay: {
            mode: "noRisk" as const,
            questionId: 100,
            themeId: 10,
            price: 100,
            priceMultiplier: 2,
            maxStake: null,
            entries: [
              {
                playerId: ALICE,
                answer: null,
                stake: null,
                submitted: false,
                isCorrect: null,
                scoreChange: null,
              },
            ],
          },
        }),
  });
  store.setState({ connection: "connected", session: initial });
  document.body.innerHTML = "";
  const node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  const emit: GameCommands["emit"] = (event, ...args) => {
    commands.push({ event, payload: args[0] });
    store.getState().setPending(event);
  };
  root.render(
    <GameContext.Provider value={{ store, myId: ALICE, connection: { connected: true, emit } }}>
      <div className="game-screen min-h-screen bg-bg p-3 text-text">
        <main className="mx-auto flex h-[90dvh] max-w-[1100px] flex-col gap-3">
          <div className="flex min-h-0 flex-1">
            <GameStage />
          </div>
          <GameActionDock />
        </main>
      </div>
    </GameContext.Provider>,
  );
}
export function actions() {
  return commands;
}
export function retrySelect() {
  store.setState({ pending: null });
}

export function revealSelect() {
  const q = store.getState().session?.state.finalRoundData?.questionData?.question;
  store.getState().dispatch({
    type: "question-finish",
    payload: {
      answerText: null,
      answerFiles: null,
      nextTurnPlayerId: null,
      timer: timer(30_000),
      correctChoice: q?.answers?.[0] ?? null,
    },
  });
}
