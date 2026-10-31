import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameContext } from "@/features/game/GameContext";
import { ALICE, BOB, SAM, question, round, session, snapshot, timer } from "@/game/fixtures";
import { createGameStore } from "@/game/store";
import { QuestionStage } from "./QuestionStage";
import { FinalAnswerStage } from "./FinalStages";
import { AnswerReveal } from "./question/AnswerReveal";
import { PlayerChips } from "./PlayerChips";
import {
  initialPreview,
  PREVIEW_PLAYERS,
  PREVIEW_SHOWMAN,
  PREVIEW_SPECTATORS,
} from "@/features/package-editor/playtest/previewModel";
import { PreviewRuntime } from "@/features/package-editor/playtest/previewRuntime";

const pointQuestion = question(100, {
  answerType: "point",
  questionFiles: [
    { order: 0, displayTime: null, file: { md5: "img", type: "image", link: "/wide.png" } },
  ],
});
const entry = (
  playerId: number,
  answer: string | null,
  submitted: boolean,
  isCorrect: boolean | null,
) => ({
  playerId,
  answer,
  submitted,
  isCorrect,
  scoreChange: isCorrect === null ? null : isCorrect ? 100 : -100,
  stake: null,
});
const allPlay = (entries: ReturnType<typeof entry>[]) => ({
  mode: "noRisk" as const,
  questionId: 100,
  price: 100,
  maxStake: null,
  priceMultiplier: null,
  entries,
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("keeps all-play point players waiting until their target picture appears", () => {
  vi.useFakeTimers();
  const q = {
    ...pointQuestion,
    text: "First",
    textOrder: 0,
    textItems: [],
    questionFiles: [
      {
        order: 1,
        displayTime: 5_000,
        file: { md5: "img", type: "image" as const, link: "/wide.png" },
      },
    ],
  };
  const store = createGameStore();
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: q,
      timer: timer(),
      allPlay: allPlay([entry(ALICE, null, false, null), entry(BOB, null, false, null)]),
    }),
  });
  render(
    <GameContext.Provider
      value={{ store, myId: ALICE, connection: { connected: true, emit: vi.fn() } }}
    >
      <PlayerChips />
      <QuestionStage />
    </GameContext.Provider>,
  );
  const chips = screen.getAllByTestId("player-chip");
  expect(chips[0]).toHaveTextContent("waiting");
  expect(screen.queryByTestId("point-picker")).toBeNull();
  act(() => vi.advanceTimersByTime(2_030));
  expect(chips[0]).toHaveTextContent("answering");
  expect(screen.getByTestId("point-picker")).toBeInTheDocument();
});

it("keeps only the local player's chosen point visible while other players answer", () => {
  const store = createGameStore();
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: pointQuestion,
      allPlay: allPlay([entry(ALICE, null, false, null), entry(BOB, "0.1,0.9", true, null)]),
    }),
  });
  const emit = vi.fn(() =>
    store.getState().dispatch({ type: "all-play-answer", payload: { playerId: ALICE } }),
  );
  render(
    <GameContext.Provider value={{ store, myId: ALICE, connection: { connected: true, emit } }}>
      <QuestionStage />
    </GameContext.Provider>,
  );
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(emit).toHaveBeenCalledWith("all-play-answer", { answerText: "0.500,0.500" });
  expect(screen.getByTestId("point-picked")).toHaveStyle({ left: "50%", top: "50%" });
  expect(screen.getByText("Answer locked in")).toBeVisible();
  expect(screen.queryByText("Click the spot on the picture")).toBeNull();
  expect(screen.queryByTestId("point-answer-marker")).toBeNull();
  expect(screen.queryByText("user3")).toBeNull();
  act(() => store.getState().dispatch({ type: "all-play-answer", payload: { playerId: BOB } }));
  expect(screen.getByTestId("point-picked")).toBeInTheDocument();
});

it("centers the reveal and labels valid points using authoritative results", () => {
  const store = createGameStore();
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      questionState: "showing_answer",
      currentQuestion: pointQuestion,
      allPlay: allPlay([
        entry(ALICE, "0.2,0.7", true, true),
        entry(BOB, "0.9,0.1", true, false),
        entry(SAM, "invalid", true, false),
      ]),
      answerShowData: {
        answerText: null,
        answerFiles: null,
        nextTurnPlayerId: null,
        answerPoint: { x: 0.5, y: 0.5 },
        answerDeviation: 0.1,
      },
    }),
  });
  render(
    <GameContext.Provider
      value={{ store, myId: ALICE, connection: { connected: true, emit: vi.fn() } }}
    >
      <AnswerReveal />
    </GameContext.Provider>,
  );
  const picker = screen.getByTestId("point-picker");
  expect(picker).toHaveClass("self-center");
  expect(within(picker).getByTestId("point-target")).toHaveStyle({
    left: "50%",
    top: "50%",
    width: "20%",
  });
  const markers = within(picker).getAllByTestId("point-answer-marker");
  expect(markers).toHaveLength(2);
  expect(within(markers[0]!).getByTestId("point-answer-dot")).toHaveStyle({
    left: "20%",
    top: "70%",
  });
  expect(within(markers[0]!).getByTestId("point-answer-label")).toHaveTextContent("user2");
  expect(markers[0]!.querySelector(".bg-success")).not.toBeNull();
  expect(within(markers[1]!).getByTestId("point-answer-dot")).toHaveStyle({
    left: "90%",
    top: "10%",
  });
  expect(within(markers[1]!).getByTestId("point-answer-label")).toHaveTextContent("user3");
  expect(markers[1]!.querySelector(".bg-danger")).not.toBeNull();
});

it("keeps the final player's own point after submission", () => {
  const store = createGameStore();
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round("final"),
      questionState: "showing",
      currentQuestion: pointQuestion,
      finalRoundData: {
        phase: "answering",
        turnOrder: [ALICE, BOB],
        bids: { [ALICE]: 100 },
        answers: [],
        eliminatedThemes: [],
        questionData: { themeId: 10, themeName: "Theme", question: pointQuestion },
      },
    }),
  });
  const emit = vi.fn(() =>
    store.getState().dispatch({ type: "final-answer-submit", payload: { playerId: ALICE } }),
  );
  render(
    <GameContext.Provider value={{ store, myId: ALICE, connection: { connected: true, emit } }}>
      <FinalAnswerStage />
    </GameContext.Provider>,
  );
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(emit).toHaveBeenCalledWith("final-answer-submit", { answerText: "0.500,0.500" });
  expect(screen.getByTestId("point-picked")).toHaveStyle({ left: "50%", top: "50%" });
  expect(screen.queryByTestId("point-target")).toBeNull();
});

it("preview preserves only each player's point across perspective changes and clears on restart and replay", () => {
  const q = {
    ...pointQuestion,
    type: "noRisk" as const,
    subType: "forEveryone",
    answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
    answerDeviation: 0.1,
  };
  const names = {
    showman: "Host",
    players: ["P1", "P2", "P3"] as [string, string, string],
    spectator: "Spectator",
    round: "Round",
    final: "Final",
    theme: "Theme",
  };
  const game = new PreviewRuntime(
    initialPreview(false, "Theme", q, names, () => 0),
    q,
  );
  game.pick();
  game.ready();
  const stage = (id: number) => (
    <GameContext.Provider value={{ store: game.store, myId: id, connection: game.commands }}>
      <QuestionStage />
    </GameContext.Provider>
  );
  const view = render(stage(PREVIEW_PLAYERS[0]));
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(screen.getByTestId("point-picked")).toHaveStyle({ left: "50%", top: "50%" });
  expect(screen.getByText(/Your selected point: 50%.*50%/)).toHaveClass("sr-only");
  act(() => game.setPerspective(PREVIEW_PLAYERS[1]));
  view.rerender(stage(PREVIEW_PLAYERS[1]));
  expect(screen.queryByTestId("point-picked")).toBeNull();
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "ArrowRight" });
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(screen.getByTestId("point-picked")).toHaveStyle({ left: "52%", top: "50%" });
  for (const id of [PREVIEW_SHOWMAN, PREVIEW_SPECTATORS[0]]) {
    act(() => game.setPerspective(id));
    view.rerender(stage(id));
    expect(screen.queryByTestId("point-picked")).toBeNull();
    expect(screen.queryByTestId("point-answer-marker")).toBeNull();
  }
  act(() => game.setPerspective(PREVIEW_PLAYERS[0]));
  view.rerender(stage(PREVIEW_PLAYERS[0]));
  expect(screen.getByTestId("point-picked")).toHaveStyle({ left: "50%", top: "50%" });
  act(() => game.setPerspective(PREVIEW_PLAYERS[2]));
  view.rerender(stage(PREVIEW_PLAYERS[2]));
  expect(screen.queryByTestId("point-picked")).toBeNull();
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(screen.getAllByTestId("point-answer-marker")).toHaveLength(3);
  expect(screen.getByTestId("answer-reveal")).toHaveTextContent("P1");
  expect(screen.getByTestId("answer-reveal")).toHaveTextContent("P2");
  expect(screen.getByTestId("answer-reveal")).toHaveTextContent("P3");
  const restarted = new PreviewRuntime(
    initialPreview(false, "Theme", q, names, () => 0),
    q,
  );
  expect(restarted.store.getState().pointSelections.byPlayer).toEqual({});
  act(() =>
    game.dispatch({
      type: "all-play-start",
      payload: {
        mode: "noRisk",
        questionId: 100,
        players: [...PREVIEW_PLAYERS],
        price: 100,
        maxStake: null,
        priceMultiplier: null,
        timer: null,
      },
    }),
  );
  expect(game.store.getState().pointSelections.byPlayer).toEqual({});
});

it("hides a tentative point when submission fails or times out", () => {
  const store = createGameStore();
  store.setState({
    connection: "connected",
    session: session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: pointQuestion,
      allPlay: allPlay([entry(ALICE, null, false, null)]),
    }),
  });
  const emit = vi.fn(() => store.getState().setPending("all-play-answer"));
  render(
    <GameContext.Provider value={{ store, myId: ALICE, connection: { connected: true, emit } }}>
      <QuestionStage />
    </GameContext.Provider>,
  );
  fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
  expect(screen.getByTestId("point-picked")).toBeInTheDocument();
  act(() => store.getState().setPending(null));
  expect(store.getState().pointSelections.byPlayer).toEqual({});
  expect(screen.queryByTestId("point-picked")).toBeNull();
  expect(screen.getByText("Click the spot on the picture")).toBeVisible();
  act(() => {
    store.getState().setPointSelection("ABCD:1:100", ALICE, { x: 0.2, y: 0.7 });
    store.getState().dispatch({
      type: "game-data",
      payload: snapshot({
        currentRound: round(),
        questionState: "showing",
        currentQuestion: pointQuestion,
        allPlay: allPlay([entry(ALICE, "", true, null)]),
      }),
    });
  });
  expect(store.getState().pointSelections.byPlayer).toEqual({});
  expect(screen.queryByTestId("point-picked")).toBeNull();
});

it("keeps a point on a resent question but clears it for a new attempt of the same id", () => {
  const store = createGameStore();
  store.setState({
    gameId: "ABCD",
    session: session({
      currentRound: round(),
      questionState: "showing",
      currentQuestion: pointQuestion,
      allPlay: allPlay([entry(ALICE, "", true, null)]),
    }),
  });
  store.getState().setPointSelection("ABCD:1:100", ALICE, { x: 0.2, y: 0.7 });
  store
    .getState()
    .dispatch({ type: "question-data", payload: { data: pointQuestion, timer: timer() } });
  expect(store.getState().pointSelections.byPlayer[ALICE]).toEqual({ x: 0.2, y: 0.7 });
  store.getState().dispatch({
    type: "all-play-start",
    payload: {
      mode: "noRisk",
      questionId: 100,
      players: [ALICE],
      price: 100,
      maxStake: null,
      priceMultiplier: null,
      timer: null,
    },
  });
  expect(store.getState().pointSelections.byPlayer).toEqual({});
});

it.each(["all-play-answer", "final-answer-submit"] as const)(
  "waits for the player's own %s acknowledgement",
  (action) => {
    const store = createGameStore();
    const final = action === "final-answer-submit";
    store.setState({
      gameId: "ABCD",
      connection: "connected",
      session: session({
        currentRound: round(final ? "final" : "simple"),
        questionState: "showing",
        currentQuestion: pointQuestion,
        allPlay: final
          ? null
          : allPlay([entry(ALICE, null, false, null), entry(BOB, null, false, null)]),
        finalRoundData: final
          ? {
              phase: "answering",
              turnOrder: [ALICE, BOB],
              bids: { [ALICE]: 100 },
              answers: [],
              eliminatedThemes: [],
              questionData: { themeId: 10, themeName: "Theme", question: pointQuestion },
            }
          : null,
      }),
    });
    const emit = vi.fn(() => store.getState().setPending(action, ALICE));
    render(
      <GameContext.Provider value={{ store, myId: ALICE, connection: { connected: true, emit } }}>
        {final ? <FinalAnswerStage /> : <QuestionStage />}
      </GameContext.Provider>,
    );
    fireEvent.keyDown(screen.getByTestId("point-picker"), { key: "Enter" });
    expect(screen.getByTestId("point-picked")).toBeVisible();
    act(() => store.getState().dispatch({ type: action, payload: { playerId: BOB } }));
    expect(store.getState().pending?.action).toBe(action);
    expect(screen.getByTestId("point-picked")).toBeVisible();
    act(() => store.getState().dispatch({ type: action, payload: { playerId: ALICE } }));
    expect(store.getState().pending).toBeNull();
    expect(screen.getByTestId("point-picked")).toBeVisible();
    expect(screen.getByText("Answer locked in")).toBeVisible();
  },
);
