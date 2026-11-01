import { mountGame, sent } from "./round-transition.fixture";
import { GameConnection } from "../src/game/connection";
import { ALICE, BOB, choosing, question, timer } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { buildContentPlan } from "../src/game/contentPlan";
import type { PlayerRole } from "../src/game/protocol";

export { sent };
let delay = 0;
let kind = "simple";
let media = false;
let preparation: number[] = [];

export function mount(
  role: PlayerRole = "player",
  readyMs = 0,
  questionKind = "simple",
  video = false,
  reduced = false,
  theme = "midnight",
) {
  delay = readyMs;
  kind = questionKind;
  media = video;
  sent.length = 0;
  mountGame(0, reduced);
  useSettings.getState().update({ theme, pins: {} });
  resetBoard(role);
  GameConnection.prototype.emit = (name, ...args) => {
    sent.push(name);
    if (name === "question-pick") pick((args[0] as { questionId: number }).questionId);
  };
}

export function resetBoard(role: PlayerRole = "player") {
  preparation.forEach(clearTimeout);
  preparation = [];
  const s = choosing();
  s.players = s.players.map((p) =>
    p.meta.id === ALICE
      ? { ...p, role }
      : role === "showman" && p.role === "showman"
        ? { ...p, role: "spectator" }
        : p,
  );
  useGameStore.getState().setSession(s);
}

function pickedQuestion(id = 100) {
  return question(id, {
    text: "Which planet has the shortest day?",
    textOrder: media ? null : 0,
    type: kind === "secret" ? "secret" : kind === "stake" ? "stake" : "simple",
    questionFiles: media
      ? [
          {
            order: 1,
            displayTime: 4000,
            file: { type: "video", md5: "opening-clip", link: "/e2e/fixtures/clip.webm" },
          },
        ]
      : [],
  });
}

export function pick(id = 100) {
  const store = useGameStore.getState();
  if (kind === "secret") {
    store.dispatch({
      type: "secret-question-picked",
      payload: { questionId: id, pickerPlayerId: ALICE, transferType: "any" },
    });
  } else if (kind === "stake") {
    store.dispatch({
      type: "stake-question-picked",
      payload: {
        questionId: id,
        pickerPlayerId: ALICE,
        maxPrice: null,
        biddingOrder: [ALICE, BOB],
        timer: timer(30000),
      },
    });
  } else {
    store.dispatch({
      type: "question-data",
      payload: { data: pickedQuestion(id), timer: timer(30000) },
    });
    preparation.push(window.setTimeout(() => ready(id), delay));
  }
}

export function ready(id = 100) {
  const q = pickedQuestion(id);
  useGameStore.getState().dispatch({
    type: "media-download-status",
    payload: {
      playerId: ALICE,
      mediaDownloaded: true,
      allPlayersReady: true,
      timer: timer(30000),
      contentPlan: buildContentPlan({
        text: q.text,
        textOrder: q.textOrder,
        files: q.questionFiles,
      }),
      buzzerOpensAtMs: 0,
    },
  });
}

export function repick() {
  resetBoard();
  pick();
}

export function snapshot() {
  return {
    opening: useGameStore.getState().questionPresentation,
    state: useGameStore.getState().session?.state,
    sent,
  };
}
