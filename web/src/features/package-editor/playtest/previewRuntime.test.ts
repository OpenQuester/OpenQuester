import { describe, expect, it } from "vitest";
import { newQuestion } from "../packageDraft";
import { checkPreviewAnswer } from "./checkPreviewAnswer";
import { initialPreview, PREVIEW_PLAYERS, PREVIEW_SHOWMAN, previewQuestion } from "./previewModel";
import { PreviewRuntime } from "./previewRuntime";
import { useGameStore } from "@/game/store";
import { choosing } from "@/game/fixtures";

const names = {
  showman: "Host",
  players: ["P1", "P2", "P3"] as [string, string, string],
  spectator: "Spectator",
  round: "Round",
  final: "Final",
  theme: "Theme",
};
function setup(patch: Parameters<typeof newQuestion>[1] = {}, final = false) {
  const draft = newQuestion(100, { text: "Question", answerText: "42", ...patch });
  const question = previewQuestion(draft, final, new Map());
  return new PreviewRuntime(
    initialPreview(final, "Target", question, names, () => 0),
    question,
  );
}

describe("local question playtest", () => {
  it("keeps the live game untouched and filters private answers before rendering", () => {
    const live = useGameStore.getState().session;
    const game = setup({ answerType: "number", answerNumber: 42, answerDeviation: 1 });
    game.advance("");
    expect(game.store.getState().session?.state.currentQuestion).not.toHaveProperty("answerNumber");
    game.setPerspective(PREVIEW_SHOWMAN);
    expect(game.store.getState().session?.state.currentQuestion?.answerNumber).toBe(42);
    game.setPerspective(PREVIEW_PLAYERS[0]);
    game.advance("");
    game.advance("");
    game.advance("");
    game.advance("42");
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.players.find((p) => p.meta.id === PREVIEW_PLAYERS[0])?.score).toBe(1100);
    expect(useGameStore.getState().session).toBe(live);
  });

  it("keeps the picker after wrong answers and gives the turn to a correct answerer", () => {
    const wrong = setup({ answerType: "number", answerNumber: 42 });
    wrong.advance("");
    wrong.advance("");
    wrong.advanceWait();
    for (const id of [PREVIEW_PLAYERS[1], PREVIEW_PLAYERS[2], PREVIEW_PLAYERS[0]]) {
      wrong.buzz(id);
      wrong.submit("41");
    }
    expect(wrong.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);

    const correct = setup({ answerType: "number", answerNumber: 42 });
    correct.advance("");
    correct.advance("");
    correct.advanceWait();
    correct.buzz(PREVIEW_PLAYERS[1]);
    correct.submit("42");
    expect(correct.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[1]);
  });

  it("hides the price of a hidden question on the board until it is picked", () => {
    const game = setup({ type: "hidden", price: 350 });
    const cell = game.session.state
      .currentRound!.themes.flatMap((theme) => theme.questions)
      .find((q) => q.id === 100);
    expect(cell?.price).toBeNull();
    game.advance("");
    expect(game.session.state.currentQuestion?.price).toBe(350);
  });

  it("ignores stale commands and timers after the preview is disposed", () => {
    const game = setup();
    const before = game.session;
    game.dispose();
    game.advance("answer");
    game.timeout();
    game.commands.emit("question-pick", { questionId: 100 });
    expect(game.session).toBe(before);
  });

  it("keeps a concurrently updating live game independent of the preview", () => {
    useGameStore.setState({ session: choosing() });
    const game = setup();
    const previewVersion = game.session.version;
    useGameStore
      .getState()
      .dispatch({ type: "score-changed", payload: { playerId: 2, newScore: 777 } });
    expect(useGameStore.getState().session?.players.find((p) => p.meta.id === 2)?.score).toBe(777);
    expect(game.session.version).toBe(previewVersion);
    game.advance("");
    expect(useGameStore.getState().session?.players.find((p) => p.meta.id === 2)?.score).toBe(777);
    expect(game.session.players.find((p) => p.meta.id === 2)?.score).toBe(1000);
  });

  it("uses the visible player for game controls independently of the test actor", () => {
    const game = setup({
      type: "noRisk",
      forEveryone: true,
      answerType: "number",
      answerNumber: 42,
    });
    game.advance("");
    game.advance("");
    game.setActor(PREVIEW_PLAYERS[0]);
    game.setPerspective(PREVIEW_PLAYERS[1]);
    game.commands.emit("all-play-answer", { answerText: "42" });
    expect(
      game.session.state.allPlay?.entries.find((entry) => entry.playerId === PREVIEW_PLAYERS[1])
        ?.submitted,
    ).toBe(true);
    expect(
      game.session.state.allPlay?.entries.find((entry) => entry.playerId === PREVIEW_PLAYERS[0])
        ?.submitted,
    ).toBe(false);
    game.advance("41");
    expect(
      game.session.state.allPlay?.entries.find((entry) => entry.playerId === PREVIEW_PLAYERS[0])
        ?.submitted,
    ).toBe(true);
  });

  it("submits the prepared answer only for the selected answering player", () => {
    const game = setup({ answerType: "number", answerNumber: 42 });
    game.advance("");
    game.advance("");
    game.advanceWait();
    game.buzz(PREVIEW_PLAYERS[1]);
    game.advance("42");
    expect(game.session.state.questionState).toBe("answering");
    game.setActor(PREVIEW_PLAYERS[1]);
    game.advance("42");
    expect(game.session.state.questionState).toBe("showing_answer");
  });

  it("retains choice delay and does not use answerDelay for the question clock", () => {
    const game = setup({ type: "choice", text: "Hello", showDelay: 4000, answerDelay: 30_000 });
    game.advance("");
    game.advance("");
    expect(game.session.state.buzzerOpensAtMs).toBe(6000);
    expect(game.session.state.timer?.durationMs).toBe(26_500);
    game.commands.emit("question-answer");
    expect(game.session.state.buzzerLocks?.[String(PREVIEW_PLAYERS[0])]).toBeDefined();
    expect(game.session.state.questionState).toBe("showing");
  });

  it("requires transfer and custom price before showing a secret question", () => {
    const game = setup({
      type: "secret",
      transferType: "exceptCurrent",
      allowedPrices: [300, 500],
    });
    game.advance("");
    expect(game.session.state.questionState).toBe("secret_transfer");
    game.advance("");
    expect(game.session.state.secretQuestionData?.priceSelection?.playerId).toBe(
      PREVIEW_PLAYERS[1],
    );
    game.advance("");
    expect(game.session.state.answeringPlayer).toBe(PREVIEW_PLAYERS[1]);
    expect(game.session.state.currentQuestion?.price).toBe(300);
  });

  it("runs an auction before the stake winner answers", () => {
    const game = setup({ type: "stake" });
    game.advance("");
    for (let i = 0; i < 3; i++) game.advance("");
    expect(game.session.state.stakeQuestionData?.winnerPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.answeringPlayer).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.stakeQuestionData?.highestBid).toBe(100);
  });

  it("can open a high-price auction and finishes immediately at its maximum", () => {
    const game = setup({ type: "stake", price: 2000, maxPrice: 2000 });
    game.advance("");
    game.advance("");
    expect(game.session.state.stakeQuestionData?.highestBid).toBe(2000);
    expect(game.session.state.stakeQuestionData?.winnerPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.questionState).toBe("answering");
  });

  it("ends an all-in auction when no other player can outbid it", () => {
    const game = setup({ type: "stake", price: 2000, maxPrice: 3000 });
    game.advance("");
    game.commands.emit("stake-bid-submit", { bidType: "all-in", bidAmount: null });
    expect(game.session.state.stakeQuestionData?.winnerPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.state.stakeQuestionData?.highestBid).toBe(2100);
    expect(game.session.state.questionState).toBe("answering");
  });

  it("holds timeout while paused and expires question and reveal when resumed", () => {
    const game = setup();
    game.advance("");
    game.advance("");
    game.pause(true);
    game.timeout();
    expect(game.session.state.questionState).toBe("showing");
    game.pause(false);
    game.timeout();
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);
    game.timeout();
    expect(game.session.finished).toBe(true);
    game.pause(true);
    game.advance("");
    expect(game.session.finished).toBe(true);
    expect(game.session.state.isPaused).toBe(false);
  });

  it("expires missing everyone-answer and final answers with the appropriate score", () => {
    const everyone = setup({
      type: "stake",
      forEveryone: true,
      answerType: "number",
      answerNumber: 42,
    });
    everyone.advance("");
    everyone.timeout();
    everyone.advance("");
    everyone.setActor(PREVIEW_PLAYERS[0]);
    everyone.advance("42");
    everyone.timeout();
    expect(everyone.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual(
      [1100, 900, 900],
    );

    const final = setup({}, true);
    final.timeout();
    final.timeout();
    final.timeout();
    expect(final.session.state.finalRoundData?.phase).toBe("answering");
    final.timeout();
    expect(final.session.finished).toBe(true);
    expect(final.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual([
      999, 999, 999,
    ]);
  });

  it("scores every player on a no-risk question without penalizing wrong answers", () => {
    const game = setup({
      type: "noRisk",
      forEveryone: true,
      priceMultiplier: 2,
      answerType: "number",
      answerNumber: 42,
    });
    game.advance("");
    game.advance("");
    for (const [id, value] of [
      [2, "42"],
      [3, "41"],
      [4, "42"],
    ] as const) {
      game.setActor(id);
      game.advance(value);
    }
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);
    expect(game.session.players.filter((p) => p.role === "player").map((p) => p.score)).toEqual([
      1200, 1000, 1200,
    ]);
  });

  it("hides answers from the spectator until everyone-answer review and lets the showman judge", () => {
    const game = setup({ type: "noRisk", forEveryone: true });
    game.advance("");
    game.advance("");
    game.setPerspective(PREVIEW_SHOWMAN);
    expect(game.store.getState().session?.state.currentQuestion?.answerText).toBe("42");
    game.setPerspective(5);
    expect(game.store.getState().session?.state.currentQuestion).not.toHaveProperty("answerText");
    for (const id of PREVIEW_PLAYERS) {
      game.setActor(id);
      game.advance(`Answer ${id}`);
    }
    expect(game.session.state.questionState).toBe("reviewing");
    expect(game.store.getState().session?.state.allPlay?.entries[0]?.answer).toBe("Answer 2");
    game.setPerspective(PREVIEW_SHOWMAN);
    for (const id of PREVIEW_PLAYERS)
      game.commands.emit("all-play-review", { playerId: id, isCorrect: id === PREVIEW_PLAYERS[1] });
    expect(game.session.state.questionState).toBe("showing_answer");
    expect(game.session.state.answerShowData?.nextTurnPlayerId).toBe(PREVIEW_PLAYERS[0]);
  });

  it("keeps final answers for showman review even when they are numbers", () => {
    const game = setup({ answerType: "number", answerNumber: 42 }, true);
    for (let i = 0; i < 5; i++) game.advance("");
    expect(game.session.state.finalRoundData?.phase).toBe("answering");
    for (const id of PREVIEW_PLAYERS) {
      game.setActor(id);
      game.advance("42");
    }
    const answers = game.session.state.finalRoundData?.answers ?? [];
    expect(answers).toHaveLength(3);
    expect(answers.every((answer) => answer.isCorrect == null)).toBe(true);
    game.setPerspective(PREVIEW_SHOWMAN);
    game.command({
      type: "final-answer-review",
      payload: { answerId: answers[0]!.id, isCorrect: true },
    });
    expect(game.session.players.find((p) => p.meta.id === PREVIEW_PLAYERS[0])?.score).toBe(1100);
  });

  it("matches numeric, choice and modern point answer checking", () => {
    const number = setup({ answerType: "number", answerNumber: 42, answerDeviation: 1 }).question;
    expect(checkPreviewAnswer(number, "43")).toBe(true);
    expect(checkPreviewAnswer(number, "44")).toBe(false);
    const point = setup({
      answerType: "point",
      answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
      answerDeviation: 0.1,
    }).question;
    expect(checkPreviewAnswer(point, "0.5,0.7")).toBe(true);
    expect(checkPreviewAnswer(point, "0.5,0.71")).toBe(false);
    const choice = setup({
      type: "choice",
      answerText: "Blue",
      options: [
        { id: "a", text: "Blue", file: null },
        { id: "b", text: "Red", file: null },
      ],
    }).question;
    expect(checkPreviewAnswer(choice, "blue")).toBe(true);
    expect(checkPreviewAnswer(choice, "Red")).toBe(false);
  });
});
