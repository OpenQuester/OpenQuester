import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ALICE, BOB, choosing, question, round, snapshot, timer } from "./fixtures";
import { createGameStore } from "./store";
import { contentElapsed, presentedQuestionContent, questionOpening } from "./questionPresentation";
import type { QuestionType, ServerEvent } from "./protocol";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

function game() {
  const store = createGameStore();
  store.setState({ gameId: "ABCD", connection: "connected" });
  store.getState().setSession(choosing());
  return store;
}
function pick(store: ReturnType<typeof game>, type: QuestionType = "simple") {
  store.getState().dispatch({
    type: "question-data",
    payload: { data: question(100, { type, textOrder: 0 }), timer: timer(30000) },
  });
}
function ready(store: ReturnType<typeof game>) {
  store.getState().dispatch({
    type: "media-download-status",
    payload: { playerId: ALICE, mediaDownloaded: true, allPlayersReady: true, timer: timer() },
  });
}

it.each<QuestionType>(["simple", "hidden", "choice", "noRisk", "secret", "stake"])(
  "uses the confirmed %s question type for its opening",
  (type) => {
    const store = game();
    store.getState().dispatch({
      type: "question-data",
      payload: { data: question(100, { type }), timer: timer() },
    });
    expect(store.getState().questionPresentation?.type).toBe(type);
  },
);

it("records confirmed live picks without changing the server session or its clock", () => {
  const store = game();
  const before = store.getState().session!;
  pick(store);
  const p = store.getState().questionPresentation!;
  expect(p).toMatchObject({
    id: 1,
    theme: "Capitals",
    price: 100,
    questionId: 100,
    type: "simple",
  });
  expect(p.previousSession).toBe(before);
  expect(before.state.currentRound?.themes[0]?.questions[0]?.isPlayed).toBe(false);
  const media = store.getState().session!;
  ready(store);
  const current = store.getState().session!;
  expect(current.state.questionState).toBe("showing");
  expect(current.state.timer).not.toBe(media.state.timer);
  expect(questionOpening(store.getState().questionPresentation)).toBe(true);
  expect(presentedQuestionContent(current, p)?.frozenAtMs).toBe(0);
  expect(current.content?.frozenAtMs).toBeNull();
});

it.each<ServerEvent>([
  {
    type: "secret-question-picked",
    payload: { questionId: 100, pickerPlayerId: ALICE, transferType: "any" },
  },
  {
    type: "stake-question-picked",
    payload: {
      questionId: 100,
      pickerPlayerId: ALICE,
      maxPrice: null,
      biddingOrder: [ALICE, BOB],
      timer: timer(),
    },
  },
  {
    type: "all-play-start",
    payload: {
      mode: "stake",
      questionId: 100,
      players: [ALICE, BOB],
      price: 100,
      maxStake: null,
      priceMultiplier: null,
      timer: timer(),
    },
  },
])("starts one opening for $type", (event) => {
  const store = game();
  store.getState().dispatch(event);
  const p = store.getState().questionPresentation!;
  expect(p.id).toBe(1);
  expect(p.type).toBe(event.type === "secret-question-picked" ? "secret" : "stake");
  if (event.type === "secret-question-picked")
    store.getState().dispatch({
      type: "secret-question-transfer",
      payload: { fromPlayerId: ALICE, toPlayerId: BOB, questionId: 100 },
    });
  expect(store.getState().questionPresentation?.id).toBe(1);
});

it("starts no-risk everyone once, on its actual question data", () => {
  const store = game();
  store.getState().dispatch({
    type: "all-play-start",
    payload: {
      mode: "noRisk",
      questionId: 100,
      players: [ALICE, BOB],
      price: 100,
      maxStake: null,
      priceMultiplier: null,
      timer: null,
    },
  });
  expect(store.getState().questionPresentation).toBeNull();
  pick(store, "noRisk");
  expect(store.getState().questionPresentation?.type).toBe("noRisk");
  const id = store.getState().questionPresentation?.id;
  ready(store);
  pick(store, "noRisk");
  expect(store.getState().questionPresentation?.id).toBe(id);
});

it("gives a repeated question a new identity and ignores stale callbacks", () => {
  const store = game();
  pick(store);
  const first = store.getState().questionPresentation!.id;
  store.getState().setSession(choosing());
  pick(store);
  const second = store.getState().questionPresentation!;
  expect(second.id).toBeGreaterThan(first);
  store.getState().finishQuestionOpening(first);
  expect(store.getState().questionPresentation).toBe(second);
  expect(second.complete).toBe(false);
});

it("never reveals a hidden board price from private question data", () => {
  const store = game();
  const before = choosing();
  before.state.currentRound!.themes[0]!.questions[0]!.price = null;
  store.getState().setSession(before);
  pick(store);
  expect(store.getState().questionPresentation?.price).toBeNull();
});

it("starts no animation on snapshots, re-sent data or final questions", () => {
  const store = game();
  store.getState().dispatch({
    type: "game-data",
    payload: snapshot({
      currentRound: round(),
      currentQuestion: question(),
      questionState: "showing",
      timer: timer(),
    }),
  });
  pick(store);
  expect(store.getState().questionPresentation).toBeNull();
  store
    .getState()
    .setSession({ ...choosing(), state: { ...choosing().state, currentRound: round("final") } });
  pick(store);
  expect(store.getState().questionPresentation).toBeNull();
});

it("follows the server clock after the intro and through pause, freeze and resume", () => {
  const store = game();
  pick(store);
  ready(store);
  const id = store.getState().questionPresentation!.id;
  vi.advanceTimersByTime(900);
  store.getState().finishQuestionOpening(id);
  const p = store.getState().questionPresentation!;
  const session = store.getState().session!;
  expect(contentElapsed(presentedQuestionContent(session, p)!, false)).toBe(900);
  vi.advanceTimersByTime(500);
  expect(contentElapsed(presentedQuestionContent(session, p)!, false)).toBe(1400);
  const localPosition = () => {
    const state = store.getState();
    return contentElapsed(
      presentedQuestionContent(state.session!, state.questionPresentation)!,
      state.session!.state.isPaused,
    );
  };
  store.getState().dispatch({
    type: "game-pause",
    payload: { timer: { ...timer(), elapsedMs: 1400 } },
  });
  vi.advanceTimersByTime(1000);
  expect(localPosition()).toBe(1400);
  store.getState().dispatch({
    type: "game-unpause",
    payload: { timer: { ...timer(), elapsedMs: 1400 } },
  });
  vi.advanceTimersByTime(200);
  store.getState().dispatch({
    type: "question-answer",
    payload: { userId: BOB, timer: timer() },
  });
  vi.advanceTimersByTime(1000);
  expect(localPosition()).toBe(1600);
  store.getState().dispatch({
    type: "answer-result",
    payload: {
      answerResult: { player: BOB, result: -100, score: -100, answerType: "wrong" },
      timer: { ...timer(), elapsedMs: 1600 },
    },
  });
  vi.advanceTimersByTime(300);
  expect(localPosition()).toBe(1900);
  expect(session.state.timer?.elapsedMs).toBe(0);
  expect(session.content?.timer?.elapsedMs).toBe(0);
});

it("retains a completed same-question intro on rejoin and cancels unfinished openings", () => {
  const store = game();
  pick(store);
  const data = snapshot({
    currentRound: round(),
    currentQuestion: question(),
    questionState: "showing",
    timer: timer(),
  });
  store.getState().dispatch({ type: "game-data", payload: data });
  expect(store.getState().questionPresentation).toBeNull();
  store.getState().setSession(choosing());
  pick(store);
  ready(store);
  vi.advanceTimersByTime(900);
  store.getState().finishQuestionOpening(store.getState().questionPresentation!.id);
  const opening = store.getState().questionPresentation;
  store.getState().setConnection("reconnecting");
  store.getState().dispatch({ type: "game-data", payload: data });
  expect(store.getState().questionPresentation).toBe(opening);
  store.getState().setSession(choosing());
  expect(store.getState().questionPresentation).toBeNull();
});

it.each(["reconnect", "round", "leave", "begin"] as const)(
  "cancels an active opening on %s",
  (ending) => {
    const store = game();
    pick(store);
    if (ending === "reconnect") store.getState().setConnection("reconnecting");
    else if (ending === "round")
      store.getState().setSession({
        ...choosing(),
        state: { ...choosing().state, currentRound: { ...round(), id: 2 } },
      });
    else if (ending === "leave") store.getState().markLeft("left");
    else store.getState().begin("NEXT");
    expect(store.getState().questionPresentation).toBeNull();
  },
);

it("restores only an active server opening from a reconnect snapshot", () => {
  const store = game();
  const opening = { timer: timer(1550), mediaReady: false };
  store.getState().dispatch({
    type: "game-data",
    payload: snapshot({
      currentRound: round(),
      currentQuestion: question(100),
      questionState: "media_downloading",
      timer: timer(30_000),
      questionTransition: opening,
    }),
  });
  expect(store.getState().questionPresentation).toMatchObject({
    serverDriven: true,
    questionId: 100,
    previousSession: null,
    complete: false,
  });
  store.getState().dispatch({
    type: "game-data",
    payload: snapshot({
      currentRound: round(),
      currentQuestion: question(100),
      questionState: "showing",
      timer: timer(),
      questionTransition: null,
    }),
  });
  expect(store.getState().questionPresentation).toBeNull();
});
