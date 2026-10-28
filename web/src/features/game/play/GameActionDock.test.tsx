import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, BOB, question, round, SAM, session, SHOWMAN, timer } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";

import { GameContext } from "../GameContext";
import { GameActionDock } from "./GameActionDock";
import { SecretStage } from "./SpecialStages";

function renderDock(s: GameSession, myId: number) {
  const emit = vi.fn();
  useGameStore.setState({ session: s, connection: "connected", pending: null });
  const connection = { emit, connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId }}>
      <GameActionDock />
    </GameContext.Provider>,
  );
  return emit;
}

const showing = (extra = {}) =>
  session({
    currentRound: round(),
    questionState: "showing",
    currentQuestion: question(100),
    timer: timer(),
    ...extra,
  });

describe("Dock", () => {
  beforeEach(() => useGameStore.setState({ session: null, pending: null }));

  it.each(["bidding", "answering"] as const)(
    "preserves a final %s draft across pause and reconnect",
    (phase) => {
      const s = session({
        currentRound: round("final"),
        questionState: phase === "bidding" ? "bidding" : "answering",
        currentQuestion: question(200),
        timer: timer(60_000),
        finalRoundData: {
          phase,
          bids: phase === "answering" ? { [ALICE]: 100 } : {},
          answers: [],
          turnOrder: [ALICE],
          eliminatedThemes: [],
        },
      });
      s.players = s.players.map((p) => ({ ...p, score: 1000 }));
      renderDock(s, ALICE);
      const input = screen.getByRole("textbox");
      fireEvent.change(input, {
        target: { value: phase === "bidding" ? "575" : "Draft final answer" },
      });
      act(() =>
        useGameStore.setState({ session: { ...s, state: { ...s.state, isPaused: true } } }),
      );
      expect(input).not.toBeVisible();
      act(() => useGameStore.setState({ session: s, connection: "reconnecting" }));
      expect(input).not.toBeVisible();
      act(() => useGameStore.setState({ connection: "connected" }));
      expect(screen.getByRole("textbox")).toBe(input);
      expect(input).toHaveValue(phase === "bidding" ? "575" : "Draft final answer");
    },
  );

  it.each(["all-play", "final"] as const)(
    "isolates %s answer drafts across perspectives and timer submission",
    (mode) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
      try {
        const entries = [ALICE, BOB].map((playerId) => ({
          playerId,
          stake: null,
          answer: null,
          submitted: false,
          isCorrect: null,
          scoreChange: null,
        }));
        const s = session({
          currentRound: round(mode === "final" ? "final" : "simple"),
          currentQuestion: question(100),
          questionState: mode === "final" ? "answering" : "showing",
          timer: timer(2000),
          ...(mode === "final"
            ? {
                finalRoundData: {
                  phase: "answering" as const,
                  bids: { [ALICE]: 100, [BOB]: 100 },
                  answers: [],
                  turnOrder: [ALICE, BOB],
                  eliminatedThemes: [],
                },
              }
            : {
                allPlay: {
                  mode: "noRisk" as const,
                  questionId: 100,
                  price: 100,
                  maxStake: null,
                  priceMultiplier: null,
                  entries,
                },
              }),
        });
        const emit = vi.fn();
        const connection = { emit, connected: true } as unknown as GameConnection;
        useGameStore.setState({ session: s, connection: "connected", pending: null });
        const ui = (myId: number) => (
          <GameContext.Provider value={{ connection, myId }}>
            <GameActionDock />
          </GameContext.Provider>
        );
        const { rerender, unmount } = render(ui(ALICE));
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "private player one" } });
        rerender(ui(BOB));
        expect(screen.getByRole("textbox")).toHaveValue("");
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "player two" } });
        act(() => vi.advanceTimersByTime(1250));
        expect(emit).toHaveBeenCalledExactlyOnceWith(
          mode === "final" ? "final-answer-submit" : "all-play-answer",
          { answerText: "player two" },
        );
        unmount();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["all-play", "final"] as const)("isolates %s bid drafts across perspectives", (mode) => {
    const entries = [ALICE, BOB].map((playerId) => ({
      playerId,
      stake: null,
      answer: null,
      submitted: false,
      isCorrect: null,
      scoreChange: null,
    }));
    const s = session({
      currentRound: round(mode === "final" ? "final" : "simple"),
      questionState: "bidding",
      timer: timer(60000),
      ...(mode === "final"
        ? {
            finalRoundData: {
              phase: "bidding" as const,
              bids: {},
              answers: [],
              turnOrder: [ALICE, BOB],
              eliminatedThemes: [],
            },
          }
        : {
            allPlay: {
              mode: "stake" as const,
              questionId: 100,
              price: 100,
              maxStake: null,
              priceMultiplier: null,
              entries,
            },
          }),
    });
    s.players = s.players.map((player) => ({ ...player, score: 1000 }));
    const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
    useGameStore.setState({ session: s, connection: "connected", pending: null });
    const ui = (myId: number) => (
      <GameContext.Provider value={{ connection, myId }}>
        <GameActionDock />
      </GameContext.Provider>
    );
    const { rerender } = render(ui(ALICE));
    fireEvent.change(screen.getByRole("textbox", { name: "Your bid" }), {
      target: { value: "137" },
    });
    rerender(ui(BOB));
    expect(screen.getByRole("textbox", { name: "Your bid" })).not.toHaveValue("137");
  });

  it("requires a fresh secret recipient for a different question and ignores a departed player", async () => {
    const s = session({
      currentRound: round(),
      questionState: "secret_transfer",
      secretQuestionData: {
        questionId: 100,
        pickerPlayerId: ALICE,
        transferType: "any",
        transferDecisionPhase: true,
      },
    });
    const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
    useGameStore.setState({ session: s, connection: "connected" });
    render(
      <GameContext.Provider value={{ connection, myId: ALICE }}>
        <SecretStage />
        <GameActionDock />
      </GameContext.Provider>,
    );
    await userEvent.click(screen.getByRole("radio", { name: /user3/ }));
    expect(screen.getByRole("radio", { name: /user3/ })).toBeChecked();
    act(() =>
      useGameStore.setState({
        session: { ...s, players: s.players.filter((p) => p.meta.id !== BOB) },
      }),
    );
    expect(screen.queryByRole("radio", { name: /user3/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /user2/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("dock-status")).not.toHaveTextContent("user3");
    act(() =>
      useGameStore.setState({
        session: {
          ...s,
          state: {
            ...s.state,
            secretQuestionData: { ...s.state.secretQuestionData!, questionId: 101 },
          },
        },
      }),
    );
    expect(screen.getByRole("radio", { name: /user3/ })).not.toBeChecked();
  });

  it("preserves the answer field across pause and reconnect, but resets it for another question", () => {
    const s = showing({ questionState: "answering", answeringPlayer: ALICE });
    renderDock(s, ALICE);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "draft survives" } });
    act(() => useGameStore.setState({ session: { ...s, state: { ...s.state, isPaused: true } } }));
    expect(input).not.toBeVisible();
    act(() => useGameStore.setState({ session: s, connection: "reconnecting" }));
    expect(input).not.toBeVisible();
    act(() => useGameStore.setState({ connection: "connected" }));
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("draft survives");
    act(() =>
      useGameStore.setState({
        session: {
          ...s,
          state: { ...s.state, currentQuestion: { ...s.state.currentQuestion!, id: 200 } },
        },
      }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("gives an eligible player the buzzer and sends the buzz", async () => {
    const emit = renderDock(showing(), ALICE);
    expect(screen.getByTestId("dock-phase")).toHaveTextContent("Ready to buzz");
    await userEvent.click(screen.getByTestId("buzz"));
    expect(emit).toHaveBeenCalledWith("question-answer");
  });

  it.each(["number", "point"] as const)(
    "explains automatic checking for a regular %s answer",
    (answerType) => {
      renderDock(
        showing({
          questionState: "answering",
          answeringPlayer: ALICE,
          currentQuestion: question(100, { answerType }),
        }),
        ALICE,
      );
      expect(
        screen.getAllByText(/checked automatically; the showman reviews unrecognized answers/i)
          .length,
      ).toBeGreaterThan(0);
    },
  );

  it("explains automatic checking during everyone-answer review", () => {
    renderDock(
      showing({
        currentQuestion: question(100, { type: "noRisk", answerType: "number" }),
        allPlay: {
          mode: "noRisk",
          questionId: 100,
          price: 100,
          maxStake: null,
          priceMultiplier: 2,
          entries: [
            {
              playerId: ALICE,
              stake: null,
              answer: null,
              submitted: false,
              isCorrect: null,
              scoreChange: null,
            },
          ],
        },
      }),
      ALICE,
    );
    expect(
      screen.getAllByText(/checked automatically; the showman reviews unrecognized answers/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it("keeps final numeric answers on the manual-review path", () => {
    const s = session({
      currentRound: round("final"),
      questionState: "answering",
      currentQuestion: question(100, { answerType: "number" }),
      timer: timer(),
      finalRoundData: {
        phase: "answering",
        bids: { [ALICE]: 100 },
        answers: [],
        turnOrder: [ALICE],
        eliminatedThemes: [],
      },
    });
    renderDock(s, ALICE);
    expect(screen.queryByText(/checked automatically/i)).toBeNull();
    expect(screen.getAllByText(/answers are revealed in the review/i).length).toBeGreaterThan(0);
  });

  it("tells a spectator why they cannot buzz", () => {
    renderDock(showing(), SAM);
    expect(screen.queryByTestId("buzz")).toBeNull();
    expect(screen.getByTestId("dock-info")).toHaveTextContent("spectators can't buzz");
  });

  it("only offers Pass for questions that accept it before buzzing", async () => {
    const emit = renderDock(showing(), ALICE);
    await userEvent.click(screen.getByRole("button", { name: "Pass on this question" }));
    expect(emit).toHaveBeenCalledWith("question-skip");

    act(() =>
      useGameStore.setState({
        session: showing({
          currentQuestion: question(100, { type: "noRisk" }),
          questionEligiblePlayers: [ALICE],
        }),
      }),
    );
    expect(screen.getByTestId("buzz")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pass on this question" })).toBeNull();
  });

  it.each(["noRisk", "secret", "stake"] as const)(
    "lets the answerer give up a %s point question",
    async (type) => {
      const emit = renderDock(
        showing({
          questionState: "answering",
          answeringPlayer: ALICE,
          currentQuestion: question(100, {
            type,
            answerType: "point",
            questionFiles: [
              {
                order: 0,
                displayTime: null,
                file: { md5: "image", type: "image", link: "https://x/map.png" },
              },
            ],
          }),
        }),
        ALICE,
      );
      const giveUp = screen.getByRole("button", { name: "Give up" });
      await userEvent.click(giveUp);
      expect(emit).toHaveBeenCalledExactlyOnceWith("question-skip");
      act(() => useGameStore.setState({ pending: { action: "question-skip", at: Date.now() } }));
      expect(giveUp).toBeDisabled();
    },
  );

  it("explains an already-used buzzer", () => {
    renderDock(
      showing({
        answeredPlayers: [{ player: ALICE, result: -100, score: -100, answerType: "wrong" }],
      }),
      ALICE,
    );
    expect(screen.getByTestId("dock-info")).toHaveTextContent("You already answered this one");
  });

  it("lets the showman judge with the question value", async () => {
    const emit = renderDock(showing({ questionState: "answering", answeringPlayer: BOB }), SHOWMAN);
    expect(screen.getByTestId("dock-status")).toHaveTextContent("user3 is answering — judge it");
    await userEvent.click(screen.getByTestId("judge-wrong"));
    expect(emit).toHaveBeenCalledWith("answer-result", { scoreResult: -100, answerType: "wrong" });
  });

  it("offers a single neutral zero-point ruling and disables it while pending", async () => {
    const emit = renderDock(showing({ questionState: "answering", answeringPlayer: BOB }), SHOWMAN);
    const skip = screen.getByRole("button", { name: "Skip, 0" });
    expect(screen.queryByTestId("judge-correct-zero")).toBeNull();
    expect(screen.queryByTestId("judge-wrong-zero")).toBeNull();
    await userEvent.click(skip);
    expect(emit).toHaveBeenCalledExactlyOnceWith("answer-result", {
      answerType: "skip",
      scoreResult: 0,
    });
    act(() => useGameStore.setState({ pending: { action: "answer-result", at: Date.now() } }));
    expect(skip).toBeDisabled();
  });

  it("freezes actions while paused", () => {
    renderDock(showing({ isPaused: true }), ALICE);
    expect(screen.getByTestId("dock-phase")).toHaveTextContent("Paused");
    expect(screen.queryByTestId("buzz")).toBeNull();
  });

  it("sends the chosen auction amount or the distinct all-in/pass actions and guards pending", async () => {
    const s = session({
      currentRound: round(),
      currentQuestion: question(100, { type: "stake", price: 100 }),
      currentTurnPlayerId: ALICE,
      questionState: "bidding",
      stakeQuestionData: {
        pickerPlayerId: ALICE,
        questionId: 100,
        maxPrice: null,
        bids: { [BOB]: 100 },
        passedPlayers: [],
        biddingOrder: [ALICE, BOB],
        currentBidderIndex: 0,
        highestBid: 100,
        winnerPlayerId: null,
        biddingPhase: true,
      },
    });
    s.players = s.players.map((p) => ({ ...p, score: p.meta.id === ALICE ? 600 : 500 }));
    const emit = renderDock(s, ALICE);
    const slider = screen.getByRole("slider", { name: "Bid amount slider" });
    fireEvent.change(slider, { target: { value: "250" } });
    expect(screen.getByRole("textbox", { name: "Your bid" })).toHaveValue("250");
    await userEvent.click(screen.getByTestId("bid-submit"));
    expect(emit).toHaveBeenLastCalledWith("stake-bid-submit", {
      bidType: "normal",
      bidAmount: 250,
    });
    act(() => useGameStore.setState({ pending: { action: "stake-bid-submit", at: Date.now() } }));
    expect(screen.getByTestId("bid-submit")).toBeDisabled();
    expect(screen.getByTestId("bid-pass")).toBeDisabled();
    expect(screen.getByRole("button", { name: /All-in/ })).toBeDisabled();
    act(() => useGameStore.setState({ pending: null }));
    expect(screen.getByRole("textbox", { name: "Your bid" })).toHaveValue("250");
    await userEvent.click(screen.getByRole("button", { name: /All-in/ }));
    expect(emit).toHaveBeenLastCalledWith("stake-bid-submit", {
      bidType: "all-in",
      bidAmount: null,
    });
    await userEvent.click(screen.getByTestId("bid-pass"));
    expect(emit).toHaveBeenLastCalledWith("stake-bid-submit", { bidType: "pass", bidAmount: null });
  });

  it.each(["all-play", "final"] as const)(
    "submits the slider value in %s bidding",
    async (mode) => {
      const common = {
        currentRound: round(mode === "final" ? "final" : "simple"),
        questionState: "bidding" as const,
      };
      const s =
        mode === "final"
          ? session({
              ...common,
              finalRoundData: {
                phase: "bidding",
                bids: {},
                answers: [],
                turnOrder: [ALICE],
                eliminatedThemes: [],
              },
            })
          : session({
              ...common,
              allPlay: {
                mode: "stake",
                questionId: 100,
                price: 100,
                maxStake: null,
                priceMultiplier: null,
                entries: [
                  {
                    playerId: ALICE,
                    stake: null,
                    answer: null,
                    submitted: false,
                    isCorrect: null,
                    scoreChange: null,
                  },
                ],
              },
            });
      s.players = s.players.map((p) => ({ ...p, score: mode === "final" ? 200 : 0 }));
      const emit = renderDock(s, ALICE);
      const slider = screen.getByRole("slider", { name: "Bid amount slider" });
      expect(slider).toHaveAttribute("max", mode === "final" ? "200" : "100");
      fireEvent.change(slider, { target: { value: "25" } });
      await userEvent.click(screen.getByTestId("bid-submit"));
      expect(emit).toHaveBeenCalledWith(
        mode === "final" ? "final-bid-submit" : "all-play-stake",
        mode === "final" ? { bid: 25 } : { amount: 25 },
      );
    },
  );
});
