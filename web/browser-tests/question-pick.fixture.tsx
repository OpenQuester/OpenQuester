import { mountGame, sent } from "./round-transition.fixture";
import { GameConnection } from "../src/game/connection";
import { ALICE, BOB, choosing, question, timer } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { buildContentPlan } from "../src/game/contentPlan";
import type { PlayerRole, QuestionType, QuestionTransition } from "../src/game/protocol";
import {
  QUESTION_TRANSITION_MS,
  QUESTION_CONTENT_START_LEAD_MS,
} from "../src/game/questionPresentation";

export { sent };
let delay = 0;
let kind: QuestionType = "simple";
let media = false;
let preparation: number[] = [];
let opening: QuestionTransition | null = null;

export function mount(
  role: PlayerRole = "player",
  readyMs = 0,
  questionKind: QuestionType = "simple",
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
  opening = null;
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
    type: kind,
    questionFiles: media
      ? [
          {
            order: 1,
            displayTime: 500,
            file: { type: "video", md5: "opening-clip", link: "/e2e/fixtures/clip.webm" },
          },
        ]
      : delay > 0
        ? [
            {
              order: 1,
              displayTime: 3000,
              file: {
                type: "image",
                md5: "opening-still",
                link: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Crect width='20' height='20' fill='gold'/%3E%3C/svg%3E",
              },
            },
          ]
        : [],
  });
}

export function pick(id = 100, selectedAt = Date.now()) {
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
    opening = {
      timer: { ...timer(QUESTION_TRANSITION_MS), startedAt: new Date(selectedAt).toISOString() },
      mediaReady: !media && delay === 0,
    };
    store.dispatch({
      type: "question-data",
      payload: {
        data: pickedQuestion(id),
        timer: media || delay > 0 ? timer(30000) : null,
        questionTransition: opening,
        contentPlan: buildContentPlan({
          text: pickedQuestion(id).text,
          textOrder: pickedQuestion(id).textOrder,
          files: pickedQuestion(id).questionFiles,
        }),
      },
    });
    if (media || delay > 0) preparation.push(window.setTimeout(() => ready(id), delay));
    else
      preparation.push(
        window.setTimeout(
          () => release(id),
          Math.max(0, selectedAt + QUESTION_TRANSITION_MS - Date.now()),
        ),
      );
  }
}

export function ready(id = 100) {
  if (!opening) return;
  if (!opening.mediaReady) {
    const elapsed = Date.now() - Date.parse(opening.timer.startedAt);
    opening = {
      mediaReady: true,
      timer: { ...opening.timer, durationMs: Math.max(QUESTION_TRANSITION_MS, elapsed + 300) },
    };
    useGameStore.getState().dispatch({
      type: "media-download-status",
      payload: {
        playerId: ALICE,
        mediaDownloaded: true,
        allPlayersReady: true,
        timer: null,
        questionTransition: opening,
        contentPlan: buildContentPlan({
          text: pickedQuestion(id).text,
          textOrder: pickedQuestion(id).textOrder,
          files: pickedQuestion(id).questionFiles,
        }),
      },
    });
    preparation.push(
      window.setTimeout(
        () => release(id),
        Math.max(0, Date.parse(opening.timer.startedAt) + opening.timer.durationMs - Date.now()),
      ),
    );
  }
}

function release(id: number) {
  if (!opening?.mediaReady) return;
  const q = pickedQuestion(id);
  const showingTimer = timer(30000);
  showingTimer.startedAt = new Date(Date.now() + QUESTION_CONTENT_START_LEAD_MS).toISOString();
  opening = null;
  useGameStore.getState().dispatch({
    type: "media-download-status",
    payload: {
      playerId: -1,
      mediaDownloaded: true,
      allPlayersReady: true,
      timer: showingTimer,
      questionTransition: null,
      contentPlan: buildContentPlan({
        text: q.text,
        textOrder: q.textOrder,
        files: q.questionFiles,
      }),
      buzzerOpensAtMs: 0,
    },
  });
}

export function confirmSpecialQuestion() {
  const store = useGameStore.getState();
  if (kind === "secret") {
    store.dispatch({
      type: "secret-question-transfer",
      payload: { fromPlayerId: ALICE, toPlayerId: BOB, questionId: 100 },
    });
  } else if (kind === "stake") {
    store.dispatch({
      type: "stake-question-winner",
      payload: { winnerPlayerId: BOB, finalBid: 100 },
    });
  }
  store.dispatch({
    type: "question-data",
    payload: { data: pickedQuestion(), timer: timer(30000) },
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

export function reconnect() {
  const store = useGameStore.getState();
  const session = store.session!;
  store.setConnection("reconnecting");
  store.dispatch({
    type: "game-data",
    payload: {
      meta: { title: session.title },
      players: session.players,
      gameState: session.state,
      chatMessages: [],
    },
  });
  store.setConnection("connected");
}
